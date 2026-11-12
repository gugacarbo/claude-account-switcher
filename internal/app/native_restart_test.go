package app

import (
	"errors"
	"testing"
)

func TestRestartStopsBeforeChangingFilesWhenNativeQuitFails(t *testing.T) {
	s := newSwitcher(t.TempDir())
	want := errors.New("quit refused")
	released, started, changed := false, false, false
	s.native.restartLaunch = func() (string, []string) { return "isolated", nil }
	s.native.awake = func() func() { return func() { released = true } }
	s.native.quit = func() error { return want }
	s.native.start = func(string, ...string) error { started = true; return nil }
	err := s.restart(func(string) error { changed = true; return nil })
	if !errors.Is(err, want) || !released || started || changed {
		t.Fatalf("err=%v released=%v started=%v changed=%v", err, released, started, changed)
	}
}
