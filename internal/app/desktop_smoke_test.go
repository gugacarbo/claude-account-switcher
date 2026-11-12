//go:build desktop_smoke && !headless

package app

import (
	"context"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"
)

var smokeApps = make(chan *application.App)
var smokeErrors = make(chan error, 1)

// Wails must run on the main OS thread, not the goroutine testing uses.
func TestMain(m *testing.M) {
	go func() { os.Exit(m.Run()) }()
	smokeErrors <- (<-smokeApps).Run()
	select {}
}

// Opt-in: launches one harmless test window against a temporary data folder.
// Never connects to real accounts or starts background switching workers.
func TestDesktopBridgeSmoke(t *testing.T) {
	assets, err := fs.Sub(frontendAssets, "dist")
	if err != nil {
		t.Fatal(err)
	}
	registerUIBindings()
	service := &UIService{s: newSwitcher(t.TempDir()), prompts: newResumeHub()}
	promptReady := make(chan struct{})
	resumeResult := make(chan []bool, 1)
	go func() {
		resumeResult <- service.prompts.ask(resumeRequest{Chats: []resumeChat{{Title: "Disposable chat"}}}, time.Minute, func() { close(promptReady) })
	}()
	<-promptReady
	result := make(chan string, 1)
	handler := application.BundledAssetFileServer(assets)
	app := application.New(application.Options{Services: []application.Service{application.NewService(service)}, Assets: application.AssetOptions{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/smoke-result" {
			select {
			case result <- r.URL.Query().Get("value"):
			default:
			}
			w.WriteHeader(204)
			return
		}
		handler.ServeHTTP(w, r)
	})}})
	win := app.Window.NewWithOptions(application.WebviewWindowOptions{Name: "smoke", URL: "/", Width: 420, Height: 640})
	win.OnWindowEvent(events.Common.WindowRuntimeReady, func(*application.WindowEvent) {
		win.ExecJS(`import('/wails/runtime.js').then(async r=>{const s=await r.Call.ByID(1);if(!Array.isArray(s.accounts))throw Error('Invalid state');await r.Call.ByID(2,85);const next=await r.Call.ByID(1);if(next.threshold!==85)throw Error('Setting did not persist');const opening=next.thresholdOpening;await r.Call.ByID(9,'threshold');const opened=await r.Call.ByID(1);if(opened.thresholdOpening!==opening+1)throw Error('Threshold opening did not reset');if(!opened.resume)throw Error('Missing resume prompt');await r.Call.ByID(13,opened.resume.id);const paused=await r.Call.ByID(1);if(!paused.resume.paused)throw Error('Resume did not pause');await r.Call.ByID(12,opened.resume.id,[false]);const deadline=Date.now()+5000;while(!document.querySelector('.empty')&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,25));if(!document.querySelector('.empty'))throw Error('React failed to load desktop state');if(document.querySelector('[role=alert]'))throw Error('React bridge error: '+document.querySelector('[role=alert]').textContent);await fetch('/smoke-result?value=ok')}).catch(e=>fetch('/smoke-result?value='+encodeURIComponent(String(e))))`)
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	outcome := make(chan string, 1)
	app.Event.OnApplicationEvent(events.Common.ApplicationStarted, func(*application.ApplicationEvent) {
		go func() {
			select {
			case value := <-result:
				outcome <- value
				app.Quit()
			case <-ctx.Done():
				outcome <- "timeout"
				app.Quit()
			}
		}()
	})
	smokeApps <- app
	select {
	case err := <-smokeErrors:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("desktop smoke timed out")
	}
	select {
	case value := <-outcome:
		if !strings.EqualFold(value, "ok") {
			t.Fatal(value)
		}
		select {
		case keep := <-resumeResult:
			if len(keep) != 1 || keep[0] {
				t.Fatalf("resume selection through bridge = %v", keep)
			}
		case <-time.After(time.Second):
			t.Fatal("resume answer did not reach Go")
		}
	case <-time.After(time.Second):
		t.Fatal("no smoke result")
	}
}
