// Package persistence owns compatible JSON storage and atomic file replacement.
package persistence

import (
	"encoding/json"
	"os"
)

// JSONStore stores a JSON value at Path. Callers serialize concurrent access.
type JSONStore struct{ Path string }

func (s JSONStore) Load(value any) error {
	data, err := os.ReadFile(s.Path)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, value)
}

func (s JSONStore) Save(value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	return WriteFileAtomic(s.Path, data)
}

// WriteFileAtomic preserves the private permissions and replacement convention
// used by existing state and credential files. The parent directory must exist.
func WriteFileAtomic(path string, data []byte) error {
	tmp := path + ".switcher-tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
