//go:build !headless && !desktop_smoke

package app

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestTrayMenuHasOnlyOpenAndQuit(t *testing.T) {
	menu := application.NewMenu()
	defer menu.Destroy()
	service := &UIService{s: newSwitcher(t.TempDir())}
	updateTrayMenu(menu, service, func() {})
	if menu.FindByLabel("Open") == nil || menu.FindByLabel("Quit") == nil {
		t.Fatal("open and quit actions are required")
	}
	if menu.FindByLabel("a@example.test — 5h 42% · week 68%") != nil || menu.FindByLabel("b@example.test — usage unknown") != nil {
		t.Fatal("tray menu must not list accounts; switching lives in the panel")
	}
	if menu.FindByLabel("No accounts yet") != nil {
		t.Fatal("empty state belongs in the panel, not the tray menu")
	}
	labels := []string{}
	for i := 0; i < 3; i++ {
		item := menu.ItemAt(i)
		if item == nil {
			t.Fatalf("missing menu item %d", i)
		}
		labels = append(labels, item.Label())
	}
	if menu.ItemAt(3) != nil {
		t.Fatal("extra tray menu items beyond Open/Quit")
	}
	if labels[0] != "Open" || labels[2] != "Quit" || labels[1] != "" {
		t.Fatalf("unexpected tray menu layout: %v", labels)
	}
}
