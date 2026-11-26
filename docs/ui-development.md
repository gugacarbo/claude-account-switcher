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
settings/threshold/resume windows. The tray icon opens the React dropdown, which
lists accounts by email with an active marker and compact 5-hour/weekly usage
percentages; other accounts can be switched directly and switching is disabled
during an operation or update. Rows refresh with backend state, alongside Open
and Quit. A host-drawn menu (Open and Quit only, no account rows) is built only
when `SWITCHER_TRAY_MENU=native` is exported. On GNOME/Ubuntu the AppIndicator
host sends `Activate` on a double click, so the dropdown needs the packaged
GNOME extension (`bun run install:gnome-extension`) to open on a single or right
click. That extension finds the icon by its StatusNotifierItem Id, which Wails
fills from the tray label: the app sets `SetLabel(appName())` on Linux before
`Run`, otherwise the Id stays "Wails" and the extension never matches.
The frontend is embedded from `frontend/dist`; build it before Go compilation.
`background.go` retains existing polling, automatic switches, update checks and
SSH scheduling. Resume deadlines live in Go, not in a throttled browser timer.
Closing resume means stop all; no answer before the deadline means continue all.
The CLI `-status` path does not initialize Wails windows.

## Development

```sh
bun run validate
bun run build
# Desktop-linked Go checks (Linux runtime libraries required):
go vet -tags purego ./...
go test -tags purego ./...
```

For hot reload, run `bun run dev`; it starts the Vite dev server and the desktop
host together. The standalone Vite page intentionally reports an unavailable
desktop connection: real commands require the Wails host. Browser tests pass a
test-only Bridge to the actual App component; production has no sample-account
mode.

The purego build loads GTK4/WebKitGTK6 on Linux, Cocoa/WebKit on macOS and
WebView2 on Windows. Linux minimum: Ubuntu 24.04 / Debian 13. Install
`libgtk-4-1 libwebkitgtk-6.0-4`. An AppIndicator/StatusNotifier host is required;
on GNOME the packaged extension supplies the single-click `Activate` and moves
the dropdown under the icon. Window anchoring is best-effort: `PositionWindow`
errors fall back to a centered compact panel, and on Wayland the compositor
ignores it for client windows, so the extension (which runs inside the
compositor) is what anchors the dropdown. The Shell imports extension code only
at startup: install or change it, then log out and back in.

Headless tests: `go test -tags headless ./...`. A headless executable is only for
CLI/core work; it is not a substitute release artifact. No frontend assets or GUI
runtime dependencies are needed for that explicit build.

## CI commands and UI evidence workflow

- `bun run check:ui` — objective UI contract gate (needs `origin/main` +
  merge-base; CI checkouts use `fetch-depth: 0`).
- `bun run check:pr-evidence` — verifies a UI-touching PR body carries the
  `## UI changes` section with an independent review verdict or an explicit
  visual-incapacity waiver (workflow `pr-ui-evidence`). Existence check only:
  it cannot guarantee visual approval.
- `bun run test:visual` — Playwright matrix (Chromium, Linux CI, 520×720,
  en-US, light). Approved baselines are committed under
  `frontend/visual/**-snapshots/`; CI uploads generated screenshots/diffs as
  artifacts with 14-day retention — they are evidence, not replacement
  baselines. The workflow only publishes images on top of the versioned
  baselines until a proven snapshot-storage alternative exists.

Known Chromium limitations (do not claim native coverage): Chromium on Linux
CI does not render Windows WebView2, macOS WebKit or native Linux
GTK/WebKit. Font rasterization, scrollbars and DPR differ on those platforms;
acceptance there remains a manual checklist item above.

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
