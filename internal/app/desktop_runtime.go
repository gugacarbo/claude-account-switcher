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
		opts.Width, opts.Height = 232, 116
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

// usesNativeTrayMenu reports whether the tray dropdown has to be drawn by the
// desktop instead of React. Wayland compositors refuse to place a client window,
// so a React popover cannot be anchored to the icon there; X11, Windows and
// macOS honour the position and keep the React dropdown. SWITCHER_TRAY_MENU
// forces a mode ("native" or "react") when validating on a specific desktop.
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
	return getenv("WAYLAND_DISPLAY") != "" || getenv("XDG_SESSION_TYPE") == "wayland"
}

func runDesktop(s *switcher, lock net.Listener) {
	hub := newResumeHub()
	service := &UIService{s: s, prompts: hub}
	assets, err := fs.Sub(frontendAssets, "dist")
	if err != nil {
		log.Fatal(err)
	}
	registerUIBindings()
	app := application.New(application.Options{Name: appName(), Description: "Independent account switching utility", Services: []application.Service{application.NewService(service)}, Assets: application.AssetOptions{Handler: application.BundledAssetFileServer(assets)}, Mac: application.MacOptions{ActivationPolicy: application.ActivationPolicyAccessory}})
	tray := app.SystemTray.New()
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
	showMenu := func() {
		// The tray dropdown is a React window placed under the icon, so it
		// keeps the app styling instead of the host menu implementation.
		// Linux hosts do not forward the click coordinates, and Wails then
		// falls back to the centre of the screen, so the anchor is computed
		// from the work area instead.
		if screen, err := panel.GetScreen(); err == nil && screen != nil {
			area := screen.WorkArea
			if area.Width <= 0 || area.Height <= 0 {
				area = screen.Bounds
			}
			width, height := menuWin.Size()
			x, y := menuPosition(area, width, height, 8)
			menuWin.SetPosition(x, y)
		} else if err := tray.PositionWindow(menuWin, 6); err != nil {
			menuWin.Center()
		}
		menuWin.Show().Focus()
	}
	// Wayland refuses to place a client window, so the dropdown falls back to the
	// host menu there; elsewhere the React popover is anchored to the work area.
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
