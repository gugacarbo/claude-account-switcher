.PHONY: frontend check build dev install gnome-extension install-gnome-extension

frontend:
	bun install --frozen-lockfile
	bun run build:ui

check:
	bun install --frozen-lockfile
	bun run validate

# purego avoids a C compiler/pkg-config at build time. Linux still needs GTK/WebKit at runtime.
build: frontend
	go build -tags "purego production" -trimpath -o dist/claude-account-switcher ./cmd/claude-account-switcher

dev: frontend
	bun run dev

# Main Linux installation: production binary in ~/.local/bin/claude-switcher,
# app-menu launcher + icon, the autostart Exec repointed when present, and the
# GNOME Shell extension reinstalled when it differs from the packaged one.
install:
	bun scripts/install-linux.ts

# GNOME Shell extension that opens the React tray dropdown on a single click.
GNOME_EXTENSION := claude-account-switcher@snlperstripes.github.com

gnome-extension:
	mkdir -p dist
	gnome-extensions pack --force --extra-source=tray.js -o dist packaging/gnome-shell/$(GNOME_EXTENSION)

install-gnome-extension: gnome-extension
	gnome-extensions install --force dist/$(GNOME_EXTENSION).shell-extension.zip
	gnome-extensions enable $(GNOME_EXTENSION) || echo "Log out and back in, then run: gnome-extensions enable $(GNOME_EXTENSION)"
