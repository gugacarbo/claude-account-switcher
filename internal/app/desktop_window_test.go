//go:build !headless && !desktop_smoke

package app

import (
	"runtime"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

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
	if opts.Width != 320 || opts.Height != 440 {
		t.Fatalf("tray menu must fit quick profiles at 320x440: got %dx%d", opts.Width, opts.Height)
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

// Wayland cannot place a client window, so the dropdown must come from the
// desktop there; other targets keep the React popover.
func TestUsesNativeTrayMenuFollowsSession(t *testing.T) {
	env := func(values map[string]string) func(string) string {
		return func(key string) string { return values[key] }
	}
	if runtime.GOOS != "linux" {
		if usesNativeTrayMenu(env(nil)) {
			t.Fatal("non-linux hosts must keep the React dropdown")
		}
		return
	}
	cases := []struct {
		name   string
		values map[string]string
		want   bool
	}{
		{"wayland", map[string]string{"WAYLAND_DISPLAY": "wayland-0"}, true},
		{"wayland session", map[string]string{"XDG_SESSION_TYPE": "wayland"}, true},
		{"x11", map[string]string{"XDG_SESSION_TYPE": "x11", "DISPLAY": ":0"}, false},
		{"forced native", map[string]string{"SWITCHER_TRAY_MENU": "native"}, true},
		{"forced react", map[string]string{"SWITCHER_TRAY_MENU": "react", "WAYLAND_DISPLAY": "wayland-0"}, false},
	}
	for _, c := range cases {
		if got := usesNativeTrayMenu(env(c.values)); got != c.want {
			t.Fatalf("%s: native = %v, want %v", c.name, got, c.want)
		}
	}
}

// A hidden GTK4 window has no surface yet, so moving it before Show silently
// does nothing. The dropdown must create the surface before applying its anchor.
func TestTrayMenuPositionsAfterShowingSurface(t *testing.T) {
	win := &unrealizedTrayWindow{}
	showPositionedTrayMenu(win, func() { win.SetPosition(1680, 40) })
	if win.x != 1680 || win.y != 40 {
		t.Fatalf("menu stayed at %d,%d: position was applied before the surface existed", win.x, win.y)
	}
	if !win.focused {
		t.Fatal("menu must receive focus after positioning")
	}
}

// The native window is the external boundary: this double models GTK4 ignoring
// movement until its surface is realized, without starting a desktop app.
type unrealizedTrayWindow struct {
	shown, focused bool
	x, y           int
}

func (w *unrealizedTrayWindow) Show() application.Window {
	w.shown = true
	return nil
}

func (w *unrealizedTrayWindow) Focus() { w.focused = w.shown && w.x == 1680 && w.y == 40 }

func (w *unrealizedTrayWindow) SetPosition(x, y int) {
	if w.shown {
		w.x, w.y = x, y
	}
}

// The host-drawn fallback keeps the two actions the React dropdown offers.
func TestNativeTrayMenuOffersOpenAndQuit(t *testing.T) {
	menu := application.NewMenu()
	defer menu.Destroy()
	updateTrayMenu(menu, &UIService{s: newSwitcher(t.TempDir())}, func() {})
	if menu.FindByLabel("Open") == nil || menu.FindByLabel("Quit") == nil {
		t.Fatal("native tray menu must offer Open and Quit")
	}
}
