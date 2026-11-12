// Package app implements the account switcher's native desktop application.
// It switches the app between signed-in accounts without signing in again,
// keeps Claude Code chats visible in every account and shows plan usage.
package app

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"
)

const version = "0.3.10"

func Run() {
	status := flag.Bool("status", false, "print accounts and usage, then exit")
	flag.Parse()

	// The home folder, because the Store app redirects AppData for everything
	// it starts but leaves the home folder alone.
	home, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}
	dir := filepath.Join(home, ".claude-account-switcher")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		log.Fatal(err)
	}
	setupLog(filepath.Join(dir, "switcher.log"), *status)
	s := newSwitcher(dir)
	language = chooseLanguage(s.st.Language, systemLanguages())

	if *status {
		printStatus(s)
		return
	}

	if relaunchOutsideDesktop(dir) {
		return
	}

	lock, ok := lockInstance(instancePort)
	if !ok {
		return
	}
	defer lock.Close()
	go removeReplaced()

	log.Printf("claude-account-switcher %s, app data in %s, language %s", version, claudeDesktop().dir, language)
	runDesktop(s, lock)
}

// setupLog writes to switcher.log and starts it over once it passes 1 MB.
// A tray app has no usable stderr on Windows, so only -status also prints there.
func setupLog(path string, console bool) {
	flags := os.O_CREATE | os.O_WRONLY | os.O_APPEND
	if info, err := os.Stat(path); err == nil && info.Size() > 1<<20 {
		flags |= os.O_TRUNC
	}
	f, err := os.OpenFile(path, flags, 0o600)
	if err != nil {
		return
	}
	if console {
		log.SetOutput(io.MultiWriter(f, os.Stderr))
	} else {
		log.SetOutput(f)
	}
}

// printStatus checks once and prints what the menu would show. It only reports:
// a switch that is due is left to the tray.
func printStatus(s *switcher) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	s.check(ctx)
	snap := s.snapshot()
	if len(snap.Accounts) == 0 {
		fmt.Println(tr("no accounts yet, sign in to Claude", "还没有账号，请先在 Claude 中登录"))
	}
	for _, a := range snap.Accounts {
		mark := " "
		if a.UUID == snap.Active {
			mark = "*"
		}
		fmt.Printf("%s %s  %s\n", mark, a.label(), usageText(a, snap.Threshold, time.Now()))
	}
}
