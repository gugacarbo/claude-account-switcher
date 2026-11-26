# Thin aliases kept for muscle memory and for docs/scripts that still call
# `make`. The commands themselves live in package.json so Bun is the single
# source of truth: `make <target>` is exactly `bun run <script>`.
.PHONY: frontend check build dev install gnome-extension install-gnome-extension

frontend:
	bun run build:ui

check:
	bun run validate

build:
	bun run build

dev:
	bun run dev

install:
	bun run install:linux

gnome-extension:
	bun run gnome-extension

install-gnome-extension:
	bun run install:gnome-extension
