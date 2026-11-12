package app

import (
	"os"
	"regexp"
	"testing"
)

func TestUIContract(t *testing.T) {
	bindings, err := os.ReadFile("ui_bindings.go")
	if err != nil {
		t.Fatal(err)
	}
	bridge, err := os.ReadFile("../../frontend/src/bridge.ts")
	if err != nil {
		t.Fatal(err)
	}
	re := regexp.MustCompile(`RegisterBindingMethodID\(\(\*UIService\)\.(\w+), (\d+)\)`)
	matches := re.FindAllStringSubmatch(string(bindings), -1)
	if len(matches) != 13 {
		t.Fatalf("expected 13 stable commands, got %d", len(matches))
	}
	for _, m := range matches {
		entry := regexp.MustCompile(`(?m)^\s*` + m[1] + `:\s*` + m[2] + `,`)
		if !entry.Match(bridge) {
			t.Errorf("bridge missing %s: %s", m[1], m[2])
		}
	}
}
