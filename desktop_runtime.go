//go:build !headless

package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

// Build frontend before compiling the desktop app (see Makefile).
//
//go:embed all:frontend/dist
var frontendAssets embed.FS

func runDesktop(s *switcher, lock net.Listener) {
	hub := newResumeHub()
	service := &UIService{s: s, prompts: hub}
	assets, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		log.Fatal(err)
	}
	registerUIBindings()
	app := application.New(application.Options{Name: appName(), Description: "Independent account switching utility", Services: []application.Service{application.NewService(service)}, Assets: application.AssetOptions{Handler: application.BundledAssetFileServer(assets)}, Mac: application.MacOptions{ActivationPolicy: application.ActivationPolicyAccessory}})
	tray := app.SystemTray.New()
	tray.SetIcon(trayIcon(-1, defaultThreshold))
	tray.SetTooltip(appName())
	windows := map[string]*application.WebviewWindow{}
	for _, name := range []string{"panel", "settings", "threshold", "resume"} {
		width, height := 420, 640
		if name == "settings" {
			width, height = 480, 620
		}
		if name == "threshold" {
			width, height = 420, 470
		}
		if name == "resume" {
			width, height = 480, 540
		}
		win := app.Window.NewWithOptions(application.WebviewWindowOptions{Name: name, Title: appName(), URL: "/?view=" + name, Width: width, Height: height, MinWidth: 360, MinHeight: 360, Hidden: true, Frameless: name == "panel", AlwaysOnTop: name == "panel" || name == "resume", HideOnFocusLost: name == "panel", HideOnEscape: name == "panel", Windows: application.WindowsWindow{HiddenOnTaskbar: name == "panel"}})
		windows[name] = win
		win.RegisterHook(events.Common.WindowClosing, func(e *application.WindowEvent) {
			e.Cancel()
			win.Hide()
			if name == "resume" {
				hub.cancel()
			}
		})
	}
	panel := windows["panel"]
	showPanel := func() {
		if panel.IsVisible() {
			panel.Hide()
			return
		}
		if err := tray.PositionWindow(panel, 6); err != nil {
			panel.Center()
		}
		panel.Show().Focus()
	}
	tray.OnClick(showPanel)
	menu := app.NewMenu()
	updateTrayMenu(menu, s.snapshot(), updating.Load(), time.Now(), service, showPanel)
	tray.SetMenu(menu)
	service.open = func(name string) { panel.Hide(); windows[name].Show().Focus(); app.Event.Emit("state-changed") }
	service.close = func(name string) { windows[name].Hide() }
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
						application.InvokeSync(func() {
							updateTrayMenu(menu, snap, updating.Load(), time.Now(), service, showPanel)
							tray.SetMenu(menu)
						})
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
