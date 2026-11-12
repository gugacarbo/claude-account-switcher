//go:build !headless && !desktop_smoke

package app

import (
	"context"
	"io/fs"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestDesktopServiceBindingIDs(t *testing.T) {
	registerUIBindings()
	application.New(application.Options{})
	bindings := application.NewBindings(nil, nil)
	if err := bindings.Add(application.NewService(&UIService{s: newSwitcher(t.TempDir())})); err != nil {
		t.Fatal(err)
	}
	method := bindings.GetByID(1)
	if method == nil {
		t.Fatal("state binding missing")
	}
	if _, err := method.Call(context.Background(), nil); err != nil {
		t.Fatal(err)
	}
	if bindings.GetByID(12) == nil || bindings.GetByID(13) == nil || bindings.GetByID(14) != nil {
		t.Fatal("binding allowlist changed")
	}
}

func TestDesktopServesBuiltAssetsAndModuleRuntime(t *testing.T) {
	assets, err := fs.Sub(frontendAssets, "frontend/dist")
	if err != nil {
		t.Fatal(err)
	}
	handler := application.BundledAssetFileServer(assets)
	for _, path := range []string{"/", "/wails/runtime.js"} {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, httptest.NewRequest("GET", path, nil))
		if response.Code != 200 {
			t.Fatalf("%s status %d", path, response.Code)
		}
		if path == "/" && !strings.Contains(response.Body.String(), "/assets/") {
			t.Fatal("production assets missing")
		}
		if path == "/wails/runtime.js" && !strings.Contains(response.Header().Get("Content-Type"), "javascript") {
			t.Fatal("runtime not JS")
		}
	}
}
