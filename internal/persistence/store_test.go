package persistence

import (
	"os"
	"path/filepath"
	"testing"
)

func TestJSONCompatibilityAndAtomicReplacement(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	store := JSONStore{Path: path}
	state := struct {
		Threshold float64 `json:"threshold"`
		Name      string  `json:"name,omitempty"`
	}{Threshold: 96}
	if err := store.Save(state); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "{\n  \"threshold\": 96\n}" {
		t.Fatalf("format changed: %s", data)
	}
	state.Threshold = 90
	if err := store.Load(&state); err != nil {
		t.Fatal(err)
	}
	if state.Threshold != 96 {
		t.Fatal(state)
	}
	if _, err := os.Stat(path + ".switcher-tmp"); !os.IsNotExist(err) {
		t.Fatal("temporary file remains")
	}
}

func TestMissingAndInvalidStateReturnErrors(t *testing.T) {
	path := filepath.Join(t.TempDir(), "state.json")
	store := JSONStore{Path: path}
	var state map[string]any
	if err := store.Load(&state); !os.IsNotExist(err) {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("invalid"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := store.Load(&state); err == nil {
		t.Fatal("invalid JSON accepted")
	}
	if err := store.Save(make(chan int)); err == nil {
		t.Fatal("serialization failure hidden")
	}
}
