package app

import "testing"

func TestSwitcherUsesInjectedDesktopResolver(t *testing.T) {
	s := newSwitcher(t.TempDir())
	calls := 0
	s.native.desktop = func() desktop { calls++; return desktop{dir: "isolated"} }
	first, second := s.app(), s.app()
	if first.dir != "isolated" || second.dir != "isolated" || calls != 2 {
		t.Fatal("desktop must be resolved on each operation")
	}
}
