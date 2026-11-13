# Architecture

This repository uses a lightweight Bun workspace and one Go module.

## Layout and boundaries

- `cmd/claude-account-switcher/main.go` is the executable entrypoint. Build this package, not the repository root.
- `internal/app` owns application orchestration, presentation services, account/profile operations, and platform implementations. Tests live beside their implementation and retain platform build constraints.
- `internal/app/native.go` provides injectable desktop discovery, process inspection, restart, and awake operations. Discovery is evaluated on every operation because app updates can relocate data. Native credential implementations remain platform-specific inside the app package; they have not been rewritten or made public.
- `internal/persistence` owns JSON state loading, serialization, and atomic replacement. Callers retain locking. Profile copies and backup rollback remain in the application package to preserve their existing transaction ordering.
- `internal/switching` makes pure decisions from a snapshot and an explicit clock; it cannot read credentials, restart processes, or persist state.
- `frontend/assets.go` embeds the existing `frontend/dist` output. Build the UI before compiling the desktop; no generated assets are copied into the command package.
- `frontend/src/App.tsx` composes views and owns the connection lifecycle. The
  panel is a unified screen: settings and threshold open in place via internal
  navigation; only the resume prompt keeps its own native window.
- `frontend/src/shared/WindowHeader.tsx` is the single title bar for every
  screen: drag region with the `--wails-draggable: drag` inline token, an
  optional back control on nested screens, and a close control that always
  targets the unified panel (`CloseWindow`, "panel") except from the resume
  window. Controls carry `--wails-draggable: no-drag` via CSS so they stay
  clickable inside the drag region.
- Features own accounts, settings, and resume views. They may import shared types and the bridge, not another feature. The architecture check enforces this rule.
- `frontend/src/bridge.ts` is the native runtime adapter. Components receive commands through props.

## Contracts and visual coverage

`TestUIContract` checks the thirteen stable command IDs. `TestUIDTOContract` derives TypeScript from the actual Go JSON DTOs, including fields, primitive types, pointers, arrays, nested chat records, and timestamps. The checked-in `frontend/src/contracts.generated.ts` is the source of frontend DTO types. Regenerate intentionally with `bun run generate:contract`; ordinary checks never update it.

Storybook renders representative component states without native runtime access, including interactive header/navigation stories and dark, long-title, and minimum-width layout states. Playwright compares real Chromium screenshots with checked-in Linux references. Dates, locale, viewport, and timezone are fixed. The visual CI job reports differences and never approves references automatically.

## Compatibility

JSON state, account directories, credentials, private file permissions, atomic writes, backup behavior, and switch reason values remain compatible. Automatic decisions retain cooldown, freshness, headroom, manual-switch pause, and idle-weekly-spending rules. Existing integration and platform tests accompany the moved files.

## Native validation

CI compiles the desktop on Linux, Windows, and macOS. Windows and macOS also run the opt-in disposable bridge smoke test. That test uses a temporary switcher data directory and does not switch real accounts. Native CI results must be inspected after publishing; Linux compilation is not proof of Windows or macOS runtime behavior.
