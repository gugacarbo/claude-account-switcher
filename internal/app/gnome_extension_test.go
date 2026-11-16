package app

import (
	"os"
	"strconv"
	"strings"
	"testing"
)

// The GNOME Shell extension finds the tray icon by its StatusNotifierItem Id,
// which is appName() in the UI language the app started with.
func TestGnomeExtensionKnowsEveryTrayID(t *testing.T) {
	src, err := os.ReadFile("../../packaging/gnome-shell/claude-account-switcher@snlperstripes.github.com/tray.js")
	if err != nil {
		t.Fatal(err)
	}
	saved := language
	defer func() { language = saved }()
	for _, lang := range []string{"en", "zh-CN"} {
		language = lang
		if id := strconv.Quote(appName()); !strings.Contains(string(src), id) {
			t.Fatalf("tray.js TRAY_IDS is missing %s", id)
		}
	}
}
