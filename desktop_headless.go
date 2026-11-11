//go:build headless

package main

import (
	"log"
	"net"
)

// Headless is an explicit test/CLI-only build, never the shipped desktop UI.
func runDesktop(*switcher, net.Listener) {
	log.Print("This headless build only supports -status; build the desktop target for the UI.")
}
