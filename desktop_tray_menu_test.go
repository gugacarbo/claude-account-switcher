//go:build !headless && !desktop_smoke

package main

import (
	"testing"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestTrayMenuRefreshReplacesAccountsAndActiveMarker(t *testing.T) {
	menu := application.NewMenu()
	defer menu.Destroy()
	service := &UIService{s: newSwitcher(t.TempDir())}
	snap := snapshot{Active: "a", Accounts: []Account{{UUID: "a", Email: "a@example.test", Usage: &Usage{Session: 42, Weekly: 68}}, {UUID: "b", Email: "b@example.test"}}}
	updateTrayMenu(menu, snap, false, time.Now(), service, func() {})
	active := menu.FindByLabel("a@example.test · Active — 5h 42% · week 68%")
	if active == nil || active.Enabled() {
		t.Fatal("active profile not shown as inactive action")
	}
	other := menu.FindByLabel("b@example.test — usage unknown")
	if other == nil || !other.Enabled() {
		t.Fatal("other profile not offered for quick switching")
	}
	if menu.FindByLabel("Open") == nil || menu.FindByLabel("Quit") == nil {
		t.Fatal("panel or quit action lost")
	}
	snap.Active = "b"
	snap.Accounts = snap.Accounts[1:]
	updateTrayMenu(menu, snap, true, time.Now(), service, func() {})
	if menu.FindByLabel("a@example.test · Active — 5h 42% · week 68%") != nil {
		t.Fatal("removed profile remains visible")
	}
	current := menu.FindByLabel("b@example.test · Active — usage unknown")
	if current == nil || current.Enabled() {
		t.Fatal("active marker did not follow backend state")
	}
}

func TestTrayMenuEmptyStateDoesNotHidePanel(t *testing.T) {
	menu := application.NewMenu()
	defer menu.Destroy()
	updateTrayMenu(menu, snapshot{}, false, time.Now(), &UIService{s: newSwitcher(t.TempDir())}, func() {})
	empty := menu.FindByLabel("No accounts yet")
	if empty == nil || empty.Enabled() {
		t.Fatal("missing non-interactive empty state")
	}
	if menu.FindByLabel("Open") == nil {
		t.Fatal("cannot reach account panel")
	}
}
