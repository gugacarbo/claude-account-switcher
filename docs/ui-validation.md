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
- Native platform acceptance remains separate from the direct Auto Pro PR review
  and the targeted review corrections documented below; subagent dispatch was
  unavailable, so no multi-reviewer assessment is claimed.

## Quick-switch tray menu follow-up

Added direct account actions to the native menu, with email, active marker and
compact 5-hour/weekly percentages. Tests cover current usage after resets, action
ID routing, error reporting, disabled busy/update actions, missing usage/problems,
and native-menu rebuilding after account/active-state changes.

Passed `make check`, `make build`, `go vet -tags purego ./...`,
`go test -race -tags purego ./...`, and purego production cross-compilation for
Windows amd64 and macOS arm64. Native host rendering and real-account switching
were not exercised for this follow-up.

## PR review corrections

The direct PR review identified two regressions, now covered by tests:

- Changing a resume checkbox pauses automatic continuation in Go. A paused
  prompt remains answerable after its original deadline, cancellation still
  stops all chats, and an untouched prompt still continues all on timeout.
  Stale pause requests are rejected; the pause/timeout decision is serialized.
- Each threshold-window opening carries a new presentation revision, resetting
  cancelled or native-closed drafts to the persisted value. Background state
  updates do not erase an in-progress edit.

Validation after the fixes: `make check` (now 9 frontend tests), `make build`,
`go vet -tags purego ./...`, `go test -race -tags purego ./...`, and the
`desktop_smoke` test. The real disposable Linux JS -> Go smoke also checks the
threshold opening revision, pause binding/state and selected resume answer.
Production cross-compilation was also repeated for Windows amd64 and macOS
arm64 with `CGO_ENABLED=0` and tags `purego production`. No real account workers
or credentials were used. Windows/macOS native runtime acceptance remains pending.

## Integration with current main and timeout-boundary correction

Integrated main through `4ed34e3`, preserving the fork updater and version
0.3.10, `/clear` session synchronization, and keep-awake behavior during account
switching. README conflicts were resolved by retaining fork download/winget
ownership information together with Wails build/runtime requirements.

An additional regression test reproduced accepted resume answers and native-close
cancellations being overridden when the timeout was also ready. Timeout handling
now checks for an accepted answer under the same mutex used by answer/cancel and
pause. Both answer/cancel cases failed before the fix and pass afterward.

Validation repeated on the integrated branch:

- `make check` (9 frontend tests), `make build`.
- `go test -race -tags purego ./...`, `go vet -tags purego ./...`.
- Production cross-compilation with `CGO_ENABLED=0`, tags `purego production`,
  for Windows amd64, macOS arm64/amd64, and Linux arm64.
- `go test -tags 'purego desktop_smoke' -run TestDesktopBridgeSmoke -v`:
  passed against the actual disposable Linux webview and JS-to-Go bridge.

No real accounts or account-switching workers were used. The pending native
acceptance checklist above remains applicable.

## Known non-blocking tooling warning

Vitest resolves a newer internal Vite while the app build uses Vite 7.3.8;
plugin-react reports deprecated esbuild options during tests. Type checking,
tests and the production build pass. Align test/build tooling in a follow-up
when upgrading the frontend toolchain; this warning is not a UI runtime error.
