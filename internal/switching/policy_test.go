package switching

import (
	"testing"
	"time"
)

func TestChoose(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	accounts := []Account{{ID: "active", Peak: 96, HasUsage: true, CheckedAt: now}, {ID: "next", Peak: 20, HasUsage: true, CheckedAt: now}}
	input := Input{Running: true, Active: "active", AutoSwitch: true, Threshold: 96, Accounts: accounts}
	id, cause := Choose(input, now)
	if id != "next" || cause != NearlyFull {
		t.Fatalf("got %q %v", id, cause)
	}
	input.LastSwitch = now.Add(-9 * time.Minute)
	if id, _ := Choose(input, now); id != "" {
		t.Fatal("cooldown ignored")
	}
	input.LastSwitch = time.Time{}
	input.Accounts[1].Peak = 86
	if id, _ := Choose(input, now); id != "" {
		t.Fatal("headroom must be strictly below threshold minus ten")
	}
	input.Accounts[1].Peak = 20
	input.Accounts[0].CheckedAt = now.Add(-6 * time.Minute)
	if id, _ := Choose(input, now); id != "" {
		t.Fatal("stale active usage trusted")
	}
}

func TestWeekly(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	input := Input{Running: true, Active: "a", SpendWeekly: true, Threshold: 96, Accounts: []Account{
		{ID: "a", Peak: 10, Weekly: 10, HasUsage: true, CheckedAt: now},
		{ID: "b", Peak: 20, Weekly: 20, HasUsage: true, CheckedAt: now, WeeklyReset: now.Add(time.Hour)},
	}}
	if id, cause := Choose(input, now); id != "b" || cause != Weekly {
		t.Fatalf("got %q %v", id, cause)
	}
	input.LastChat = now.Add(-14 * time.Minute)
	if id, _ := Choose(input, now); id != "" {
		t.Fatal("interrupted active chat")
	}
	input.LastChat = time.Time{}
	input.HandSwitch = now.Add(-4 * time.Hour)
	if id, _ := Choose(input, now); id != "" {
		t.Fatal("hand switch pause ignored")
	}
}
