package app

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRefreshUsagePreservesBackoffAndUpdatesOtherAccounts(t *testing.T) {
	s := newSwitcher(t.TempDir())
	s.appDir = t.TempDir()
	s.st.AutoSwitch = true
	s.active = "active-account"
	s.st.Accounts = []*Account{
		{UUID: "active-account", Usage: &Usage{Session: 98, CheckedAt: time.Now()}},
		{UUID: "limited-account", Usage: &Usage{Session: 20, CheckedAt: time.Now()}},
		{UUID: "paused-account", Usage: &Usage{Session: 30, CheckedAt: time.Now()}},
	}
	for _, a := range s.st.Accounts {
		cache := fmt.Sprintf(`{"acct:%s|test:user:profile":{"token":%q,"expiresAt":%d}}`, a.UUID, a.UUID, time.Now().Add(time.Hour).UnixMilli())
		enc := base64.StdEncoding.EncodeToString(encryptForTest(t, "v10", "peanuts", []byte(cache)))
		path := filepath.Join(s.profileDir(a.UUID), "config.json")
		if a.UUID == s.active {
			path = s.app().configPath()
		}
		write(t, path, fmt.Sprintf(`{"lastKnownAccountUuid":%q,"oauth:tokenCacheV2":%q}`, a.UUID, enc))
	}
	s.backoff["paused-account"] = time.Now().Add(time.Hour)
	old := client
	t.Cleanup(func() { client = old })
	var attempts []string
	client = &http.Client{Transport: forkTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/api/oauth/usage" {
			t.Fatalf("refresh requested %s instead of usage", r.URL.Path)
		}
		id := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		attempts = append(attempts, id)
		if id == "limited-account" {
			return &http.Response{StatusCode: 429, Header: http.Header{"Retry-After": {"60"}}, Body: io.NopCloser(strings.NewReader(""))}, nil
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"five_hour":{"utilization":99}}`))}, nil
	})}
	u := &UIService{s: s}
	if err := u.RefreshUsage(); err == nil {
		t.Fatal("expected a partial refresh error")
	}
	if got := strings.Join(attempts, ","); got != "active-account,limited-account" {
		t.Fatalf("unexpected usage requests: %s", got)
	}
	got := u.State()
	if !got.Accounts[0].Active || got.Accounts[0].Usage.Session != 99 || got.Accounts[1].Usage.Session != 20 || got.Accounts[2].Usage.Session != 30 {
		t.Fatalf("unexpected accounts after refresh: %+v", got.Accounts)
	}
	attempts = nil
	_ = u.RefreshUsage()
	if got := strings.Join(attempts, ","); got != "active-account" {
		t.Fatalf("second refresh bypassed backoff: %s", got)
	}
}

func TestRefreshUsageRejectsOverlappingUsageChecks(t *testing.T) {
	s := newSwitcher(t.TempDir())
	s.usageMu.Lock()
	defer s.usageMu.Unlock()
	if err := (&UIService{s: s}).RefreshUsage(); err == nil {
		t.Fatal("expected refresh to reject an overlapping check")
	}
}
