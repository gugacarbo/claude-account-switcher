//go:build !headless && !desktop_smoke

package app

import "testing"

// Three native windows exist: the panel, the React tray menu, and the resume
// prompt. Settings and threshold became sections of the panel.
func TestDesktopCreatesPanelMenuAndResume(t *testing.T) {
	names := desktopWindowNames()
	want := []string{"panel", "menu", "resume"}
	if len(names) != len(want) {
		t.Fatalf("unexpected window set: %v", names)
	}
	for i, name := range want {
		if names[i] != name {
			t.Fatalf("window %d is %q, want %q", i, names[i], name)
		}
	}
}

func TestPanelWindowHidesWhenFocusIsLost(t *testing.T) {
	opts := windowOptions("panel")
	if !opts.Frameless {
		t.Fatal("panel must stay frameless")
	}
	if opts.AlwaysOnTop {
		t.Fatal("panel must not be always-on-top")
	}
	if !opts.HideOnFocusLost {
		t.Fatal("panel must hide when it loses focus")
	}
	if !opts.HideOnEscape {
		t.Fatal("panel must hide on escape")
	}
	if opts.Windows.HiddenOnTaskbar {
		t.Fatal("panel must stay listed in the taskbar")
	}
	if opts.MinWidth < 360 || opts.MinHeight < 360 {
		t.Fatal("panel minimum size below 360")
	}
	if opts.Width < 360 || opts.Height < 360 {
		t.Fatal("panel default size below 360")
	}
	if !opts.Hidden {
		t.Fatal("panel must start hidden and be shown on demand")
	}
}

// The tray dropdown is a React window, so no native menu is published and the
// menu window behaves like a popover: small, on top, closed when it loses focus.
func TestTrayMenuWindowBehavesLikeADropdown(t *testing.T) {
	opts := windowOptions("menu")
	if !opts.Frameless {
		t.Fatal("tray menu must be frameless")
	}
	if !opts.Hidden {
		t.Fatal("tray menu must start hidden")
	}
	if !opts.AlwaysOnTop {
		t.Fatal("tray menu must stay above other windows")
	}
	if !opts.HideOnFocusLost {
		t.Fatal("tray menu must close when it loses focus")
	}
	if !opts.HideOnEscape {
		t.Fatal("tray menu must close on escape")
	}
	if opts.Width > 320 || opts.Height > 200 {
		t.Fatalf("tray menu is not menu sized: %dx%d", opts.Width, opts.Height)
	}
	if opts.URL != "/?view=menu" {
		t.Fatalf("tray menu url is %q", opts.URL)
	}
}

func TestResumeWindowStaysFramelessPrompt(t *testing.T) {
	opts := windowOptions("resume")
	if !opts.Frameless {
		t.Fatal("resume must stay frameless")
	}
	if !opts.Hidden {
		t.Fatal("resume must start hidden")
	}
	if opts.MinWidth < 360 || opts.MinHeight < 360 {
		t.Fatal("resume minimum size below 360")
	}
}
