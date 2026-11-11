//go:build !headless

package main

import (
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Called on the UI thread once running, then published with tray.SetMenu so
// Linux's DBus menu host receives updated labels and enabled states as well.
func updateTrayMenu(menu *application.Menu, snap snapshot, updating bool, now time.Time, service *UIService, showPanel func()) {
	menu.Clear()
	menu.Add(tr("Open", "打开")).OnClick(func(*application.Context) { showPanel() })
	menu.AddSeparator()
	entries := trayAccountEntries(snap, updating, now, service.SwitchAccount, service.s.setStatus)
	if len(entries) == 0 {
		menu.Add(tr("No accounts yet", "暂无账号")).SetEnabled(false)
	}
	for _, entry := range entries {
		menu.Add(entry.label).SetEnabled(entry.enabled).OnClick(func(*application.Context) { entry.selectAccount() })
	}
	menu.AddSeparator()
	menu.Add(tr("Quit", "退出")).OnClick(func(*application.Context) {
		if err := service.Quit(); err != nil {
			service.s.setStatus(err.Error())
		}
	})
}
