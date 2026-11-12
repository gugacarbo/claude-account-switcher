# Development

## Setup

Install Go using the version in `go.mod`, Bun 1.4.3, and Node 24 (used by Node-based quality tools). Run `bun install --frozen-lockfile` from the repository root. The root `bun.lock` is authoritative for the frontend workspace too.

Linux desktop runtime requires GTK and WebKit libraries. Headless tests do not launch Claude or switch real accounts.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Vite and native desktop development processes |
| `bun run build` | Embedded frontend and native production binary |
| `bun run validate:fast` | Biome, TypeScript, Go vet |
| `bun run validate` | Fast checks, UI and Go tests, frontend build, Knip, tooling tests, architecture and command contract checks |
| `bun run validate:ci` | Local validation plus race, Go lint, secrets and vulnerability checks |
| `bun run format` | Apply Biome fixes and Go formatting |
| `bun run knip:production` | Production dependency and export analysis |
| `bun run spellcheck` | Check architecture and development documentation |

Husky runs lint-staged at pre-commit and local validation at pre-push. Staged checks format Go and check supported UI/config files; they do not run the entire Go suite for every staged file. CI is the final authority, including when hooks are disabled.

## External quality tools

Install `golangci-lint` v2, `gitleaks`, and `govulncheck` on PATH for the complete CI profile. CI installs pinned versions. Missing tools fail validation rather than silently skipping a gate. `govulncheck` may require network access to the vulnerability database. Secrets checks redact findings; do not paste credentials into logs or fixtures.

## Tests and changes

Use tests before behavioral changes. Keep the Go policy pure and pass an explicit time. Use temporary directories for persistence tests and mock bridges for UI tests. Never validate a refactor by switching a real account.

`bun run check:contract` protects command IDs and generated DTO types. After intentional Go presentation changes, run `bun run generate:contract` and review the generated diff. Keep feature imports within the same feature or shared modules. App is the composition boundary.

Run `bun run storybook` for the component catalog or `bun run build:storybook` for a static build. Install Chromium with `bunx playwright install chromium` from `frontend`, then run `bun run test:visual`. References are Linux-specific; regenerate intentionally with `bun run test:visual:update`, inspect every changed image, and include references with the UI change. CI never updates references. Behavior tests remain separate from screenshot comparisons.

The executable package is `./cmd/claude-account-switcher`; application tests are under `./internal/app`. The opt-in native check is `go test -tags 'purego production desktop_smoke' -run TestDesktopBridgeSmoke -count=1 -timeout 60s ./internal/app`. It requires a working target-platform desktop session. Windows and macOS CI execute it after building the frontend; verify remote results after publishing.
