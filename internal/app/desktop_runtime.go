//go:build !headless

package app

import (
	"context"
	webassets "github.com/SnlperStripes/claude-account-switcher/frontend"
	"io/fs"
	"log"
	"net"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Build frontend before compiling the desktop app (see Makefile).
var frontendAssets = webassets.Assets

// desktopWindowNames lists every native window: the persistent panel and the
// transient resume prompt. Settings and threshold are panel sections navigated
// via the "navigate" event, not windows.
func desktopWindowNames() []string { return []string{"panel", "resume"} }

// windowOptions is a pure descriptor so tests can assert window semantics
// without booting a GUI. The panel is persistent (no hide-on-focus, no escape
// hide, not always-on-top, visible in the taskbar); resume stays a frameless,
// always-on-top prompt.
func windowOptions(name string) application.WebviewWindowOptions {
	opts := application.WebviewWindowOptions{Name: name, Title: appName(), URL: "/?view=" + name, Width: 420, Height: 640, MinWidth: 360, MinHeight: 360, Hidden: true, Frameless: true}
	if name == "resume" {
		opts.Width, opts.Height = 480, 540
		opts.AlwaysOnTop = true
	}
	return opts
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
	var positioned bool
	showPanel := func() {
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
	tray.OnClick(showPanel)
	menu := app.NewMenu()
	updateTrayMenu(menu, service, showPanel)
	tray.SetMenu(menu)
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
