# Shared desktop UI

## Architecture

The executable uses Wails 3.1.0 with its purego desktop backend. React 19,
TypeScript and Vite own all user-facing screens. Bun 1.4.3 manages the committed
root workspace lockfile (`bun.lock`). See [development](development.md) and
[architecture](architecture.md) for the unified commands and feature boundaries. No local HTTP port is opened for the UI in production; the
existing single-instance loopback port is unchanged.

`UIService` exports an explicit presentation projection, not persisted State.
Tokens, cookie files, organization IDs and executable paths are not returned to
JavaScript. Fixed command IDs in `ui_bindings.go` / `frontend/src/bridge.ts` form
the small bridge surface. Do not bind switcher or filesystem helpers directly.

`internal/app/desktop_runtime.go` manages one background app, tray, quick panel and reusable
settings/threshold/resume windows. The native tray menu also lists accounts by
email with an active marker and compact 5-hour/weekly usage percentages. Other
accounts can be switched directly; switching is disabled during an operation or
update. Menu rows refresh with backend state, alongside Open and Quit.
The frontend is embedded from `frontend/dist`; build it before Go compilation.
`background.go` retains existing polling, automatic switches, update checks and
SSH scheduling. Resume deadlines live in Go, not in a throttled browser timer.
Closing resume means stop all; no answer before the deadline means continue all.
The CLI `-status` path does not initialize Wails windows.

## Development

```sh
make check
make build
# Desktop-linked Go checks (Linux runtime libraries required):
go vet -tags purego ./...
go test -tags purego ./...
```

For hot reload, run `bun run dev` in `frontend/`, then `make dev` in another
terminal. The standalone Vite page intentionally reports an unavailable desktop
connection: real commands require the Wails host. Browser tests pass a test-only
Bridge to the actual App component; production has no sample-account mode.

The purego build loads GTK4/WebKitGTK6 on Linux, Cocoa/WebKit on macOS and
WebView2 on Windows. Linux minimum: Ubuntu 24.04 / Debian 13. Install
`libgtk-4-1 libwebkitgtk-6.0-4`. An AppIndicator/StatusNotifier host is required;
on GNOME an appropriate tray extension may be necessary. Window anchoring is
best-effort; `PositionWindow` errors fall back to a centered compact panel.
Wayland compositors ultimately control placement.

Headless tests: `go test -tags headless ./...`. A headless executable is only for
CLI/core work; it is not a substitute release artifact. No frontend assets or GUI
runtime dependencies are needed for that explicit build.

## Platform acceptance checklist

Run on Windows with WebView2, macOS with WebKit, and supported Linux desktops
(including X11 and Wayland). Cross-compilation is not native runtime validation.
Use disposable test accounts and a test data folder; do not switch real accounts
merely to validate layout.

- Starts without an open window; tray is visible and its usage icon updates.
- Click opens/toggles panel; anchoring works where supported; fallback is usable.
- Panel dismisses on blur/Escape; settings, threshold and resume remain on blur.
- Closing any window leaves monitoring active; explicit Quit stops the process.
- Closing resume stops all chats; timeout continues all even if the window is
  hidden or the JS event loop is delayed; stale prompt answers are rejected.
- Every account is reachable, usage/reset and signed-out/error states readable.
- Switch/add/import show busy state; conflicting restarts are rejected.
- Every setting survives reopening/restarting; invalid thresholds are rejected.
- English and Simplified Chinese, dark/light, keyboard focus, zoom and scrolling
  remain usable, including with many accounts and long names/chat titles.
- Autostart, CLI status, instance locking and update handoff retain behavior.
- Production binary works without Bun, node_modules or loose web assets.

The opt-in `go test -tags 'purego desktop_smoke' -run TestDesktopBridgeSmoke -v ./internal/app`
launches a temporary window without account workers to exercise the real bridge.
It needs a functioning graphical session. Do not run it as a headless CI check.

## Validation limitations for this migration

See the final implementation report for actual command results. Native tray
positioning, start-at-login and self-update must be checked on the target desktop;
browser fixtures and cross-compilation do not prove these integrations.
