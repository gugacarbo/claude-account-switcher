# Wails + React UI migration

## Approved direction

Replace the entire presentation layer, not the account-switching business logic. Use Wails with Vite, React, TypeScript, and Bun for frontend dependencies/scripts. Preserve existing saved data, authentication safeguards, business rules, English/Simplified Chinese localization, CLI status, instance locking, polling, updates, import, autostart, and dynamic usage icon.

The app starts silently in the tray. Clicking opens a compact account/usage/action panel anchored to the tray where supported. When positioning is unavailable, show the same content in a compact window. The quick panel dismisses on loss of focus. Settings, custom threshold, and resume confirmation use auxiliary React windows that remain open on blur. Closing presentation windows must not quit the background application; only explicit Quit does. Resume prompts may appear while the panel is hidden; retain existing cancellation and timeout semantics.

Use warm neutral colors and terracotta accents, shared components, light/dark themes, keyboard navigation, visible focus, accessible labels, loading/error/empty states, and clear distinction from the official Claude app. Do not require identical native decoration or pixel-level rendering. Minimum Linux targets may increase to Ubuntu 24.04 and Debian 13, with declared webview dependencies. Bun is a development/build dependency, not an end-user prerequisite.

Wails and the requested frontend dependencies were explicitly approved in this conversation; do not create an external issue or publish anything for this run. Keep new dependencies limited to this approved migration and its required test/build support.

## Constraints

- Do not rewrite authentication, crypto, account persistence, or data migration rules.
- Never expose cookies, tokens, full persisted state, or arbitrary filesystem/shell access to JavaScript. Export a deliberately limited presentation DTO and narrowly scoped service methods. Mutating settings must call existing business methods, preserving validation and busy-state guards.
- No production mock data, no silent no-op bridge fallback, no remote UI/CDN dependency.
- Keep `-status` usable without initializing a graphical app; preserve automated tests and instance/update handoff.
- Select and pin an actually available Wails version after checking upstream documentation/source and platform APIs. Verify tray geometry/positioning and fallback rather than inventing APIs. Do not claim platform runtime validation that was not performed.
- Production web assets must be reproducible from committed source and the Bun lockfile. Desktop builds must embed actual built assets, never placeholder content.
- All implementation and fixes are delegated. No nested subagents. Create natural local commits; no push, merge, PR, external comments, or worktree removal.

## Execution units and task mapping

### A — Foundation and safe desktop bridge (tasks 1–3)

1. Verify the Wails release/API/dependencies available and choose a pinned supported version. Establish the frontend Vite/React/TypeScript/Bun project with a committed lockfile and meaningful build/typecheck/test scripts.
2. Introduce a narrow, testable presentation DTO/service for existing switcher actions and live state updates. Preserve raw account data in Go. Explicitly support all existing tray actions and dialog requests in the frontend-facing contract.
3. Establish Wails application/tray/window lifecycle, embedded assets, hidden startup, explicit quit, panel blur dismissal, auxiliary close handling, best-effort tray anchoring with compact fallback, and notification/event delivery. Avoid concurrent conflicting native tray loops. Preserve background jobs and CLI entry paths. Add focused tests for DTO redaction, validation, and window/state decision logic where possible.

Acceptance: reproducible frontend shell builds; service tests cover safe DTOs and rejected invalid actions; Wails APIs verified against the selected version; background-only startup and CLI routing are preserved by architecture/tests; foundation supports subsequent UI integration without replacing business logic. Native behavior limitations must be reported, not hidden.

Focused validation: frontend install with frozen lockfile and typecheck/build; focused Go tests for added service/window/CLI logic; compile the desktop target when system dependencies permit. Keep headless core tests possible using a documented explicit build arrangement if necessary, without making the delivered default app the obsolete UI.

### B — Complete shared React interface and dialogs (tasks 4–6)

4. Implement the account panel with active account, current usage/reset information, manual switching, add/import/update/folder/quit actions and busy/error/empty/loading states; no operations may be silently stubbed.
5. Implement auxiliary settings/custom threshold screens covering every existing automation, SSH import, and start-at-login setting. Preserve supported locales and current settings semantics. Share visual tokens/components with the panel.
6. Migrate resume selection/timeout/cancel behavior to React with real Go request/response integration, including prompts while the panel is closed. Remove runtime reliance on legacy HTML/webview/native dialog paths once replacements work.

Acceptance: all current user-visible actions are reachable through React and invoke real backend methods; no secrets reach JS; all screens share warm-neutral/terracotta light/dark styles; keyboard/accessibility behaviors and errors are handled; auxiliary windows do not dismiss on blur; resume timeout/cancel/close semantics match existing behavior.

Focused validation: frontend typecheck/build/tests covering state rendering and representative actions/settings/resume behavior; focused Go tests for dialogs and bridge integration. Render the UI in a browser using deterministic test-only fixtures where possible, inspect panel/settings/dialog screenshots and console errors, and report actual evidence. Load applicable frontend/React skills before frontend implementation.

### C — Integration, release pipeline, cleanup and documentation (tasks 7–8)

7. Integrate final lifecycle/bridge/assets/build rules. Update existing CI and distribution/packaging for frontend builds via Bun, Wails platform libraries, architectures and embedded assets; remove obsolete dependencies/paths only after inspecting references. Ensure Windows/macOS build paths remain plausible and checked as far as this environment supports.
8. Update README and contributor/build docs (including maintained translations where relevant) for stack, behavior, Linux minimums, dev dependencies and commands. Add a truthful manual platform acceptance checklist for startup/tray/anchoring/fallback/blur/auxiliary/resume/quit/CLI/autostart/update. Do not claim unperformed Windows/macOS/Wayland tests.

Acceptance: the documented default build produces the migrated app with real frontend assets; CI uses the migrated stack and supported Linux baseline; frozen Bun installation is reproducible; old runtime presentation code is not still the production path; all existing backend tests and new tests pass, or a concrete environmental blocker is reported. Docs accurately describe behavior and remaining validation gaps.

Focused validation: workflow/packaging inspection; run changed integration tests, frontend checks, and desktop compilation as appropriate. Record all exact commands and environment blockers.

## Execution and review

Three sequential units, A -> B -> C, sharing the isolated integration branch. Interface/build/asset overlap makes parallel work inappropriate. Implement/fix model: platon/auto-flash#medium. Unit reviews disabled by user. Final review only: platon/auto-pro#high. Maximum two correction rounds for final validation/review. Keep recovery state outside history under the worktree Git directory.

## Final validation

- `go vet ./...` and `go test ./...` (or the documented headless variant if the GUI toolchain requires it, plus a separate real desktop compile).
- Required build tags/CGO/platform paths tested explicitly rather than claiming headless tests validate desktop compilation.
- Frontend: frozen Bun install, typecheck, tests, production build using scripts established in A.
- Native Linux desktop production build with required system libraries if available; otherwise record exact missing dependency as a release-validation blocker.
- Browser-rendered UI smoke/visual/accessibility checks using test-only fixtures; real desktop runtime checks when a display/runtime is available, with limitations stated.
- Inspect final `git diff --check`, clean working tree, commit range, and original checkout preservation.
- Final Auto Pro review of the complete change range, including requirements, security boundary, lifecycle, packaging, tests and platform limitations. Fix only evidenced in-scope material findings, revalidate, and scoped re-review.

## Success and exclusions

Success requires a committed, validated, finally reviewed implementation on the isolated branch, with truthful platform coverage and no material unresolved defect. No new business features, backend language rewrite, authentication redesign, identical rendering guarantee, publication, or automatic worktree cleanup.
