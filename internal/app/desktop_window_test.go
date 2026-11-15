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

// Linux hosts do not forward click coordinates, so the dropdown is anchored to
// the top-right corner of the work area instead of the screen centre.
func TestMenuPositionAnchorsToWorkAreaTopRight(t *testing.T) {
	area := application.Rect{X: 1920, Y: 0, Width: 1920, Height: 1080}
	x, y := menuPosition(area, 232, 116, 8)
	if x != area.X+area.Width-232-8 {
		t.Fatalf("x = %d, want anchored to the right edge", x)
	}
	if y != area.Y+8 {
		t.Fatalf("y = %d, want anchored to the top edge", y)
	}

	// A work area shorter than the menu keeps the window inside the margins.
	small := application.Rect{X: 0, Y: 0, Width: 200, Height: 100}
	x, y = menuPosition(small, 232, 116, 8)
	if x != 8 || y != 8 {
		t.Fatalf("small work area gave %d,%d, want the top-left margin", x, y)
	}
}

// The dropdown grows with the account list and scrolls past a handful of rows.
func TestMenuHeightFollowsTheAccounts(t *testing.T) {
	if got := menuHeight(0); got != 163 {
		t.Fatalf("empty list: got %d, want 163", got)
	}
	if got := menuHeight(2); got != 127+2*52 {
		t.Fatalf("two accounts: got %d, want %d", got, 127+2*52)
	}
	if menuHeight(20) != menuHeight(maxMenuAccounts) {
		t.Fatal("long lists must scroll instead of growing the window")
	}
	if opts := windowOptions("menu"); menuHeight(0) < opts.MinHeight || menuWidth < opts.MinWidth {
		t.Fatal("computed size must respect the window minimum")
	}
}

// A forwarded tray click keeps the dropdown in the icon's column, under the
// panel; without click coordinates it falls back to the work-area corner.
func TestMenuAnchorFollowsTheTrayClick(t *testing.T) {
	bounds := application.Rect{X: 0, Y: 0, Width: 1920, Height: 1080}
	area := application.Rect{X: 0, Y: 32, Width: 1920, Height: 1048}
	cases := []struct {
		name           string
		probeX, probeY int
		wantX, wantY   int
	}{
		{"top panel click", 1400 - 116, 16, 1284, 40},
		{"click near the right edge", 1900 - 116, 16, 1680, 40},
		{"click near the left edge", 0, 16, 8, 40},
		{"bottom panel click", 1284, 964, 1284, 956},
		{"no coordinates", 844, 482, 1680, 40},
	}
	for _, c := range cases {
		x, y := menuAnchor(area, bounds, 232, 116, 8, c.probeX, c.probeY)
		if x != c.wantX || y != c.wantY {
			t.Fatalf("%s: got %d,%d, want %d,%d", c.name, x, y, c.wantX, c.wantY)
		}
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
		{"xwayland", map[string]string{"WAYLAND_DISPLAY": "wayland-0", "GDK_BACKEND": "x11"}, false},
	}
	for _, c := range cases {
		if got := usesNativeTrayMenu(env(c.values)); got != c.want {
			t.Fatalf("%s: native = %v, want %v", c.name, got, c.want)
		}
	}
}

// Inside a Wayland session the app starts on XWayland so the React dropdown can
// be positioned, unless the user chose a backend or there is no X server.
func TestPreferXWaylandOnlyWhenItCanPositionWindows(t *testing.T) {
	env := func(values map[string]string) func(string) string {
		return func(key string) string { return values[key] }
	}
	if runtime.GOOS != "linux" {
		if preferXWayland(env(map[string]string{"WAYLAND_DISPLAY": "wayland-0", "DISPLAY": ":0"})) {
			t.Fatal("non-linux hosts never switch backend")
		}
		return
	}
	cases := []struct {
		name   string
		values map[string]string
		want   bool
	}{
		{"wayland with xwayland", map[string]string{"WAYLAND_DISPLAY": "wayland-0", "DISPLAY": ":0"}, true},
		{"wayland session with xwayland", map[string]string{"XDG_SESSION_TYPE": "wayland", "DISPLAY": ":0"}, true},
		{"wayland without x server", map[string]string{"WAYLAND_DISPLAY": "wayland-0"}, false},
		{"x11", map[string]string{"XDG_SESSION_TYPE": "x11", "DISPLAY": ":0"}, false},
		{"explicit backend", map[string]string{"WAYLAND_DISPLAY": "wayland-0", "DISPLAY": ":0", "GDK_BACKEND": "wayland"}, false},
		{"forced native", map[string]string{"WAYLAND_DISPLAY": "wayland-0", "DISPLAY": ":0", "SWITCHER_TRAY_MENU": "native"}, false},
	}
	for _, c := range cases {
		if got := preferXWayland(env(c.values)); got != c.want {
			t.Fatalf("%s: prefer = %v, want %v", c.name, got, c.want)
		}
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
