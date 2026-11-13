//go:build !headless

package app

import (
	"github.com/wailsapp/wails/v3/pkg/application"
)

// updateTrayMenu builds the host-drawn tray menu. It is only registered when the
// desktop refuses to place a client window (Wayland), because there the React
// dropdown cannot be anchored to the icon; see usesNativeTrayMenu.
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
