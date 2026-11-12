.PHONY: frontend check build dev

frontend:
	bun install --frozen-lockfile
	bun run build:ui

check:
	bun install --frozen-lockfile
	bun run validate

# purego avoids a C compiler/pkg-config at build time. Linux still needs GTK/WebKit at runtime.
build: frontend
	go build -tags "purego production" -trimpath -o dist/claude-account-switcher .

dev: frontend
	bun run dev
