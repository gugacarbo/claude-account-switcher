//go:build !headless && !desktop_smoke

package app

import "testing"

// Only two native windows exist: the persistent panel and the transient resume
// prompt. Settings and threshold became sections of the panel.
func TestDesktopCreatesOnlyPanelAndResume(t *testing.T) {
	names := desktopWindowNames()
	if len(names) != 2 || names[0] != "panel" || names[1] != "resume" {
		t.Fatalf("unexpected window set: %v", names)
	}
}

func TestPanelWindowIsPersistent(t *testing.T) {
	opts := windowOptions("panel")
	if !opts.Frameless {
		t.Fatal("panel must stay frameless")
	}
	if opts.AlwaysOnTop {
		t.Fatal("panel must not be always-on-top")
	}
	if opts.HideOnFocusLost {
		t.Fatal("panel must survive losing focus")
	}
	if opts.HideOnEscape {
		t.Fatal("panel must not hide on escape")
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
