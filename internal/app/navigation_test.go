package app

import "testing"

func TestNavigationSectionAcceptsPanelSections(t *testing.T) {
	for _, name := range []string{"panel", "settings", "threshold"} {
		section, err := navigationSection(name)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if section != name {
			t.Fatalf("section %q does not match requested %q", section, name)
		}
	}
	if _, err := navigationSection("resume"); err == nil {
		t.Fatal("accepted a window that is not a panel section")
	}
	if _, err := navigationSection(""); err == nil {
		t.Fatal("accepted empty window name")
	}
}

func TestOpenWindowShowsPanelAndEmitsNavigation(t *testing.T) {
	ui := &UIService{s: newSwitcher(t.TempDir())}
	var sections []string
	ui.open = func(section string) { sections = append(sections, section) }
	// The React tray menu opens the panel through this same command.
	if err := ui.OpenWindow("panel"); err != nil {
		t.Fatal(err)
	}
	if err := ui.OpenWindow("settings"); err != nil {
		t.Fatal(err)
	}
	if err := ui.OpenWindow("threshold"); err != nil {
		t.Fatal(err)
	}
	if len(sections) != 3 || sections[0] != "panel" || sections[1] != "settings" || sections[2] != "threshold" {
		t.Fatalf("navigation callbacks got %v", sections)
	}
	if ui.thresholdOpening.Load() != 1 {
		t.Fatal("threshold opening counter not preserved")
	}
	if err := ui.OpenWindow("resume"); err == nil {
		t.Fatal("accepted a window name that is not a panel section")
	}
}

func TestCloseWindowToleratesLegacySections(t *testing.T) {
	ui := &UIService{s: newSwitcher(t.TempDir())}
	closed := []string{}
	ui.close = func(name string) { closed = append(closed, name) }
	for _, name := range []string{"panel", "menu", "resume", "settings", "threshold"} {
		if err := ui.CloseWindow(name); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
	}
	if len(closed) != 5 || closed[1] != "menu" {
		t.Fatalf("close callbacks got %v", closed)
	}
	if err := ui.CloseWindow("bogus"); err == nil {
		t.Fatal("accepted unknown window name")
	}
}
