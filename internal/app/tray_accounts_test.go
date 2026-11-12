package app

import (
	"errors"
	"strings"
	"testing"
	"time"
)

// These tests exercise the data and actions consumed by the native tray menu,
// without requiring a graphical session or touching real sign-ins.
func TestTrayAccountsShowActiveEmailAndCurrentLimits(t *testing.T) {
	now := time.Now()
	snap := snapshot{Active: "a", Accounts: []Account{
		{UUID: "a", Name: "Personal", Email: "personal@example.test", Usage: &Usage{Session: 42, Weekly: 68}},
		{UUID: "b", Name: "Work", Email: "work@example.test", Usage: &Usage{Session: 97, Weekly: 31, SessionReset: now.Add(-time.Minute)}},
	}}
	rows := trayAccountEntries(snap, false, now, func(string) error { return nil }, func(string) {})
	if len(rows) != 2 {
		t.Fatalf("accounts missing: %v", rows)
	}
	for _, part := range []string{"personal@example.test", "Active", "5h 42%", "week 68%"} {
		if !strings.Contains(rows[0].label, part) {
			t.Errorf("active label %q missing %q", rows[0].label, part)
		}
	}
	if rows[0].enabled {
		t.Fatal("active account should not offer another switch")
	}
	for _, part := range []string{"work@example.test", "5h 0%", "week 31%"} {
		if !strings.Contains(rows[1].label, part) {
			t.Errorf("available label %q missing %q", rows[1].label, part)
		}
	}
	if !rows[1].enabled {
		t.Fatal("available account is not selectable")
	}
}

func TestTrayAccountActionsRouteIDsAndReportSwitchFailure(t *testing.T) {
	snap := snapshot{Accounts: []Account{{UUID: "a", Email: "a@example.test"}, {UUID: "b", Email: "b@example.test"}}}
	var selected []string
	var reported string
	rows := trayAccountEntries(snap, false, time.Now(), func(id string) error { selected = append(selected, id); return errors.New("switch failed") }, func(message string) { reported = message })
	rows[0].selectAccount()
	rows[1].selectAccount()
	if len(selected) != 2 || selected[0] != "a" || selected[1] != "b" {
		t.Fatalf("wrong selected IDs: %v", selected)
	}
	if reported != "switch failed" {
		t.Fatalf("error not surfaced: %q", reported)
	}
}

func TestTrayAccountsBlockSwitchingWhileBusyOrUpdating(t *testing.T) {
	for _, tc := range []struct {
		name           string
		busy, updating bool
	}{{"busy", true, false}, {"updating", false, true}} {
		t.Run(tc.name, func(t *testing.T) {
			called := false
			rows := trayAccountEntries(snapshot{Busy: tc.busy, Accounts: []Account{{UUID: "a"}}}, tc.updating, time.Now(), func(string) error { called = true; return nil }, func(string) {})
			if rows[0].enabled {
				t.Fatal("switch enabled during operation")
			}
			rows[0].selectAccount()
			if called {
				t.Fatal("disabled action started a switch")
			}
		})
	}
}

func TestTrayAccountsShowProblemsAndMissingUsage(t *testing.T) {
	rows := trayAccountEntries(snapshot{Accounts: []Account{
		{UUID: "a", Email: "signedout@example.test", Problem: signedOut, Usage: &Usage{Session: 50}},
		{UUID: "b", Email: "unknown@example.test"},
		{UUID: "c", Name: "No email", Problem: "network unavailable"},
	}}, false, time.Now(), func(string) error { return nil }, func(string) {})
	for i, want := range []string{signedOut, "usage unknown", "No email"} {
		if !strings.Contains(rows[i].label, want) {
			t.Errorf("label %q missing %q", rows[i].label, want)
		}
	}
	if !strings.Contains(rows[2].label, "network unavailable") {
		t.Fatal("network problem hidden")
	}
}
