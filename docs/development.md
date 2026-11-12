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

`TestUIContract` protects stable command IDs, not all DTO fields. Update the Go presentation models, TypeScript types and fixtures together. Keep feature imports within the same feature or shared modules. App is the composition boundary.

Storybook and screenshot regression tests are not installed yet. Existing component tests are behavioral tests, not visual approval. Native runtime and platform release smoke tests still require their target operating systems.
