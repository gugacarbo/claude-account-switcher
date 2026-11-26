//go:build !headless && (!linux || gtk3 || android || server)

package app

import "unsafe"

func makeTraySurfaceTransparent(unsafe.Pointer) error { return nil }
