# Architecture

This repository is a lightweight Bun workspace and one Go module. It does not need a separate package for every folder, multiple Go modules, or a task cache server.

## Boundaries

- `frontend/src/App.tsx` composes views and owns the connection lifecycle.
- `frontend/src/features/accounts`, `settings`, and `resume` own their view components. Features may import shared types and the bridge contract, but not another feature. `bun run check:architecture` enforces this rule.
- `frontend/src/bridge.ts` is the native runtime adapter. Components receive commands through props; native runtime access does not belong in features.
- `UIService` projects presentation data and exposes an explicit command allowlist. `TestUIContract` checks the stable method IDs against the frontend map. This is a command-map check, not full DTO schema generation.
- `switcher.go` coordinates operations, locking, backups, persistence, and platform adapters.
- `internal/switching` makes pure decisions from a snapshot and an explicit clock. It cannot read credentials, restart processes, or persist state. The coordinator projects expired usage windows before calling it.
- Platform-specific files retain native credential, filesystem, process, and desktop integration responsibilities.

## Compatibility

The JSON state format, account directories, credentials, atomic writes, backup behavior, and switch reason values remain unchanged. The desktop embeds `frontend/dist`; moving that directory requires changing the embed declaration and release pipeline together.

Automatic decisions retain the ten-minute cooldown, freshness checks, strict ten-point headroom, five-hour pause after a manual switch, and fifteen-minute idle period for weekly spending. Existing coordinator tests protect integration behavior; policy tests exercise decisions without native side effects.

## Incremental migration

The coordinator still owns persistence and several platform dependencies. Extract those behind narrow, tested adapters when they need to change; do not replace working atomic writes or introduce a generic repository framework merely to relocate code. Full DTO generation and visual regression coverage are separate follow-up work.
