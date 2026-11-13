//go:build !headless

package app

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

// The tray menu is intentionally minimal: accounts are managed inside the
// persistent panel, so only Open and Quit remain. Called on the UI thread;
// publishing with tray.SetMenu keeps Linux's DBus menu host in sync.
func updateTrayMenu(menu *application.Menu, service *UIService, showPanel func()) {
	menu.Clear()
	menu.Add(tr("Open", "打开")).OnClick(func(*application.Context) { showPanel() })
	menu.AddSeparator()
	menu.Add(tr("Quit", "退出")).OnClick(func(*application.Context) {
		if err := service.Quit(); err != nil {
			service.s.setStatus(err.Error())
		}
	})
}
