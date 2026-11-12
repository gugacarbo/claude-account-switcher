//go:build !headless

// Package frontend embeds the production UI without copying build artifacts.
package frontend

import "embed"

// Assets contains the production Vite output. Build the UI before the desktop.
//
//go:embed all:dist
var Assets embed.FS
