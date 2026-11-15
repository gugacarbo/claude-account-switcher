//go:build !headless

package app

import (
	"context"
	webassets "github.com/SnlperStripes/claude-account-switcher/frontend"
	"io/fs"
	"log"
	"net"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Build frontend before compiling the desktop app (see Makefile).
var frontendAssets = webassets.Assets

// desktopWindowNames lists every native window: the panel, the React tray menu
// and the resume prompt. Settings and threshold are panel sections navigated
// via the "navigate" event, not windows.
func desktopWindowNames() []string { return []string{"panel", "menu", "resume"} }

// windowOptions is a pure descriptor so tests can assert window semantics
// without booting a GUI. Every window is frameless and starts hidden:
//   - panel: hosted sections, hidden as soon as it loses focus so it never
//     lingers behind other apps;
//   - menu: the tray dropdown rendered in React, closed on focus loss or Esc;
//   - resume: a prompt that must stay on top until it is answered.
func windowOptions(name string) application.WebviewWindowOptions {
	opts := application.WebviewWindowOptions{Name: name, Title: appName(), URL: "/?view=" + name, Width: 420, Height: 640, MinWidth: 360, MinHeight: 360, Hidden: true, Frameless: true}
	switch name {
	case "panel":
		opts.HideOnFocusLost = true
		opts.HideOnEscape = true
	case "menu":
		opts.Width, opts.Height = menuWidth, menuHeight(1)
		opts.MinWidth, opts.MinHeight = 180, 96
		opts.AlwaysOnTop = true
		opts.HideOnFocusLost = true
		opts.HideOnEscape = true
	case "resume":
		opts.Width, opts.Height = 480, 540
		opts.AlwaysOnTop = true
	}
	return opts
}

// menuWidth and menuHeight size the React tray dropdown. The heights mirror
// the fixed .tray-menu* rows in frontend/src/style.css: border and padding,
// the "Accounts" heading, one row per account (or the empty line), the
// separator and the Open/Quit items. Past maxMenuAccounts the list scrolls.
const (
	menuWidth       = 300
	maxMenuAccounts = 6
)

func menuHeight(accounts int) int {
	const chrome = 2 + 16 + 28 + 9 + 2*36
	if accounts <= 0 {
		return chrome + 36
	}
	return chrome + min(accounts, maxMenuAccounts)*52
}

// menuPosition anchors the tray dropdown to the top-right corner of the work
// area. Linux StatusNotifier hosts do not forward click coordinates, and Wails
// then centres the window, so the position is computed from the screen instead.
func menuPosition(area application.Rect, width, height, margin int) (int, int) {
	x := area.X + area.Width - width - margin
	if x < area.X+margin {
		x = area.X + margin
	}
	y := area.Y + margin
	if y+height > area.Y+area.Height {
		y = area.Y + area.Height - height - margin
	}
	if y < area.Y+margin {
		y = area.Y + margin
	}
	return x, y
}

// menuAnchor places the tray dropdown under the tray icon. probeX/probeY are
// where Wails would put the window for the last tray click: centred on the
// click when the host forwards its coordinates, centred on the screen when it
// does not. In the second case the top-right corner of the work area is used;
// otherwise the dropdown keeps the click's column and hugs the panel edge.
func menuAnchor(area, bounds application.Rect, width, height, margin, probeX, probeY int) (int, int) {
	if probeX == bounds.X+bounds.Width/2-width/2 && probeY == bounds.Y+bounds.Height/2-height/2 {
		return menuPosition(area, width, height, margin)
	}
	x := min(probeX, area.X+area.Width-width-margin)
	x = max(x, area.X+margin)
	y := area.Y + margin
	if probeY+height/2 > bounds.Y+bounds.Height/2 {
		y = max(y, area.Y+area.Height-height-margin)
	}
	return x, y
}

// positionProbe records where the tray would place a window without moving it.
type positionProbe struct {
	application.Window
	x, y int
	set  bool
}

func (p *positionProbe) SetPosition(x, y int) { p.x, p.y, p.set = x, y, true }

// usesNativeTrayMenu reports whether the tray dropdown has to be drawn by the
// desktop instead of React. A native Wayland client cannot place its own
// window, so a React popover cannot be anchored to the icon there; X11 (which
// includes XWayland, see preferXWayland), Windows and macOS honour the position
// and keep the React dropdown. SWITCHER_TRAY_MENU forces a mode ("native" or
// "react") when validating on a specific desktop.
func usesNativeTrayMenu(getenv func(string) string) bool {
	if runtime.GOOS != "linux" {
		return false
	}
	switch getenv("SWITCHER_TRAY_MENU") {
	case "native":
		return true
	case "react":
		return false
	}
	return isWaylandSession(getenv) && getenv("GDK_BACKEND") != "x11"
}

func isWaylandSession(getenv func(string) string) bool {
	return getenv("WAYLAND_DISPLAY") != "" || getenv("XDG_SESSION_TYPE") == "wayland"
}

// preferXWayland reports whether GTK should be started on the X11 backend
// inside a Wayland session. Through XWayland the app may position its own
// windows, which keeps the React tray dropdown anchored instead of falling back
// to the host menu. An explicit GDK_BACKEND, a forced native menu or a session
// without an X server is left alone.
func preferXWayland(getenv func(string) string) bool {
	if runtime.GOOS != "linux" || !isWaylandSession(getenv) {
		return false
	}
	return getenv("GDK_BACKEND") == "" && getenv("DISPLAY") != "" && getenv("SWITCHER_TRAY_MENU") != "native"
}

func runDesktop(s *switcher, lock net.Listener) {
	// Must run before GTK initialises, which happens inside application.New.
	if preferXWayland(os.Getenv) {
		_ = os.Setenv("GDK_BACKEND", "x11")
	}
	hub := newResumeHub()
	service := &UIService{s: s, prompts: hub}
	assets, err := fs.Sub(frontendAssets, "dist")
	if err != nil {
		log.Fatal(err)
	}
	registerUIBindings()
	app := application.New(application.Options{Name: appName(), Description: "Independent account switching utility", Services: []application.Service{application.NewService(service)}, Assets: application.AssetOptions{Handler: application.BundledAssetFileServer(assets)}, Mac: application.MacOptions{ActivationPolicy: application.ActivationPolicyAccessory}})
	tray := app.SystemTray.New()
	if runtime.GOOS == "linux" {
		// Wails publishes the label as the StatusNotifierItem Id, "Wails" when
		// unset; the GNOME Shell extension finds the app's icon by this Id.
		tray.SetLabel(appName())
	}
	tray.SetIcon(trayIcon(-1, defaultThreshold))
	tray.SetTooltip(appName())
	windows := map[string]*application.WebviewWindow{}
	for _, name := range desktopWindowNames() {
		win := app.Window.NewWithOptions(windowOptions(name))
		windows[name] = win
		win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
			// Closing hides instead of destroying: the panel keeps its
			// position, an open resume prompt is cancelled.
			e.Cancel()
			win.Hide()
			if name == "resume" {
				hub.cancel()
			}
		})
	}
	panel := windows["panel"]
	menuWin := windows["menu"]
	var positioned bool
	showPanel := func() {
		// The dropdown closes first so it never floats over the panel.
		menuWin.Hide()
		// Show/focus is idempotent, never a toggle, and the window is
		// positioned only once so user moves are preserved across opens.
		if !positioned {
			if err := tray.PositionWindow(panel, 6); err != nil {
				panel.Center()
			}
			positioned = true
		}
		panel.Show().Focus()
	}
	menuTarget := func() (int, int, bool) {
		// The primary screen is used because a window that was never shown
		// has no screen of its own yet.
		screen := app.Screen.GetPrimary()
		if screen == nil {
			screen, _ = menuWin.GetScreen()
		}
		if screen == nil {
			return 0, 0, false
		}
		area := screen.WorkArea
		if area.Width <= 0 || area.Height <= 0 {
			area = screen.Bounds
		}
		width, height := menuWin.Size()
		probe := &positionProbe{Window: menuWin}
		if err := tray.PositionWindow(probe, 0); err != nil || !probe.set {
			x, y := menuPosition(area, width, height, 8)
			return x, y, true
		}
		x, y := menuAnchor(area, screen.Bounds, width, height, 8, probe.x, probe.y)
		return x, y, true
	}
	showMenu := func() {
		// The tray dropdown is a React window placed under the icon, so it
		// keeps the app styling instead of the host menu implementation.
		menuWin.SetSize(menuWidth, menuHeight(len(s.snapshot().Accounts)))
		x, y, ok := menuTarget()
		if ok {
			menuWin.SetPosition(x, y)
		} else {
			menuWin.Center()
		}
		menuWin.Show().Focus()
		// X11 window managers place a window themselves when it is mapped and
		// ignore the position requested before that, so it is applied again.
		if ok {
			menuWin.SetPosition(x, y)
		}
	}
	// A native Wayland client cannot place its window, so the dropdown falls back
	// to the host menu there; elsewhere the React popover is anchored to the work area.
	if usesNativeTrayMenu(os.Getenv) {
		menu := app.NewMenu()
		updateTrayMenu(menu, service, showPanel)
		tray.SetMenu(menu)
	} else {
		tray.OnClick(showMenu)
		tray.OnRightClick(showMenu)
	}
	service.open = func(section string) {
		showPanel()
		app.Event.Emit("navigate", section)
	}
	service.close = func(name string) {
		if win, ok := windows[name]; ok {
			win.Hide()
		}
	}
	service.quit = app.Quit
	resumeInUI = func(req resumeRequest, wait time.Duration) []bool {
		result := hub.ask(req, wait, func() { windows["resume"].Show().Focus(); app.Event.Emit("state-changed") })
		windows["resume"].Hide()
		app.Event.Emit("state-changed")
		return result
	}
	changes := make(chan struct{}, 1)
	s.onChange = func() {
		select {
		case changes <- struct{}{}:
		default:
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	var start sync.Once
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		start.Do(func() {
			if autostartEnabled() {
				if err := setAutostart(true); err != nil {
					log.Printf("refresh start at login: %v", err)
				}
			}
			go serveInstance(lock, func() {
				for !s.busy.CompareAndSwap(false, true) {
					time.Sleep(200 * time.Millisecond)
				}
				app.Quit()
			})
			go func() {
				for {
					select {
					case <-ctx.Done():
						return
					case <-changes:
						snap := s.snapshot()
						pct := -1.0
						for _, a := range snap.Accounts {
							if a.UUID == snap.Active && a.Usage != nil {
								pct = a.Usage.current(time.Now()).Session
							}
						}
						tray.SetIcon(trayIcon(pct, snap.Threshold))
						app.Event.Emit("state-changed")
					}
				}
			}()
			go runBackground(ctx, s)
			s.onChange()
		})
	})
	if err := app.Run(); err != nil {
		log.Printf("desktop: %v", err)
	}
}
