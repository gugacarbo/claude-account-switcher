//go:build !headless && !gtk3 && !android && !server

package app

import (
	"errors"
	"fmt"
	"unsafe"

	"github.com/ebitengine/purego"
)

const trayWindowClass = "claude-switcher-tray"

const trayNativeCSS = `
window.claude-switcher-tray,
window.claude-switcher-tray > #webview-box {
  background: transparent;
  box-shadow: none;
}
`

// Wails makes the WebKit view transparent, but its GTK4 setTransparent is
// empty. Clear the GTK window and its box too; React paints the rounded card.
// Called on the GTK thread, with the native window already allocated.
func makeTraySurfaceTransparent(window unsafe.Pointer) error {
	gtk, err := purego.Dlopen("libgtk-4.so.1", purego.RTLD_LAZY|purego.RTLD_LOCAL)
	if err != nil {
		return err
	}
	defer purego.Dlclose(gtk)

	var (
		getDisplay  func(unsafe.Pointer) uintptr
		newProvider func() uintptr
		loadCSS     func(uintptr, string, int)
		addProvider func(uintptr, uintptr, uint32)
		addClass    func(unsafe.Pointer, string)
		unref       func(uintptr)
	)
	for _, sym := range []struct {
		name string
		dest any
	}{
		{"gtk_widget_get_display", &getDisplay},
		{"gtk_css_provider_new", &newProvider},
		{"gtk_css_provider_load_from_data", &loadCSS},
		{"gtk_style_context_add_provider_for_display", &addProvider},
		{"gtk_widget_add_css_class", &addClass},
		{"g_object_unref", &unref},
	} {
		addr, err := purego.Dlsym(gtk, sym.name)
		if err != nil {
			return fmt.Errorf("resolve %s: %w", sym.name, err)
		}
		purego.RegisterFunc(sym.dest, addr)
	}
	display := getDisplay(window)
	if display == 0 {
		return errors.New("GTK display unavailable")
	}
	provider := newProvider()
	if provider == 0 {
		return errors.New("GTK CSS provider unavailable")
	}
	defer unref(provider)
	loadCSS(provider, trayNativeCSS, -1)
	addProvider(display, provider, 600) // GTK_STYLE_PROVIDER_PRIORITY_APPLICATION
	addClass(window, trayWindowClass)
	return nil
}
