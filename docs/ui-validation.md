# UI migration validation evidence

Executed on Linux Ubuntu 26.04, Go 1.27.3, Bun 1.4.3, Wails 3.1.0,
GTK 4.22.4 / WebKitGTK 2.52.6. This does not claim runtime testing on the
minimum supported distribution releases.

## Passed

- `make check`: headless Go vet/tests; frozen Bun installation; TypeScript;
  7 frontend tests in 3 files; Vite production build.
- `go vet -tags purego ./...`.
- `go test -race -tags purego ./...`: desktop-linked Go tests and race detector.
- `make build`: embeds the production frontend in a Linux desktop executable.
- `go test -tags 'purego desktop_smoke' -run TestDesktopBridgeSmoke -v`:
  real GTK/WebKit window, real JS -> Go bindings, threshold mutation/readback,
  and the production React app reaching its connected empty-account state
  without an alert. Uses a disposable data directory and no background workers.
- Cross-compilation with `CGO_ENABLED=0`, tags `purego production`:
  Windows amd64; macOS arm64 and amd64; Linux arm64.
- CLI help runs from the desktop binary without initializing a graphical app.
- Browser-rendered test-only fixtures inspected at 420px: account panel,
  settings and custom threshold; no horizontal clipping in the inspected views.
  The panel scrolls vertically with multiple accounts. Screenshots remain local
  under ignored `.playwright-mcp/` and are not production assets.

The frontend tests cover account switching command routing, setting mutation,
threshold validation, selected resume answers, surfaced command errors,
missing desktop runtime, and refreshing a reused threshold window.
Go tests cover allowlisted/detached DTOs, persistent validated settings, invalid
accounts/options, concurrent restart rejection, quit reservation, resume
selection/cancel/timeout/stale-answer behavior, asset serving and stable binding IDs.

## Pending manual acceptance

- Tray icon interaction, positioning/fallback, blur/Escape and auxiliary window
  lifecycle on actual Windows/macOS and Linux X11/Wayland desktops.
- End-to-end account switching, SSH import, real autostart and self-update on
  disposable accounts on each OS. No real credentials were switched for tests.
- Visual dark-mode, Chinese and keyboard/accessibility acceptance across native
  webviews; automated tests and shared CSS do not replace those checks.
- Independent final Auto Pro review: unavailable because subagent dispatch was
  not functioning. Direct implementation was explicitly requested instead.

## Known non-blocking tooling warning

Vitest resolves a newer internal Vite while the app build uses Vite 7.3.8;
plugin-react reports deprecated esbuild options during tests. Type checking,
tests and the production build pass. Align test/build tooling in a follow-up
when upgrading the frontend toolchain; this warning is not a UI runtime error.
