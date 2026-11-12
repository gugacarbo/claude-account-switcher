// Package switching contains automatic switching decisions, without I/O or mutable state.
package switching

import "time"

type Cause int

const (
	Manual Cause = iota
	NearlyFull
	Weekly
)

type Account struct {
	ID                     string
	Peak, Weekly           float64
	CheckedAt, WeeklyReset time.Time
	Problem                string
	HasUsage               bool
}

type Input struct {
	Running, AutoSwitch, SpendWeekly             bool
	Active, Spending                             string
	Threshold                                    float64
	LastSwitch, HandSwitch, LastChat, SpendUntil time.Time
	Accounts                                     []Account
}

// Choose returns an account ID and reason, or an empty ID when no switch is safe.
// Usage must already be projected to now (expired windows reset by the caller).
func Choose(in Input, now time.Time) (string, Cause) {
	var cur *Account
	for i := range in.Accounts {
		if in.Accounts[i].ID == in.Active {
			cur = &in.Accounts[i]
			break
		}
	}
	if !in.Running || cur == nil || !cur.HasUsage || now.Sub(cur.CheckedAt) > 5*time.Minute || now.Sub(in.LastSwitch) < 10*time.Minute {
		return "", Manual
	}
	usable := func(a *Account) bool {
		return a.ID != cur.ID && a.HasUsage && a.Problem == "" && now.Sub(a.CheckedAt) <= 15*time.Minute && a.Peak < in.Threshold-10
	}
	spendable := func(a *Account) bool {
		return (a.ID == in.Spending && now.Before(in.SpendUntil)) || (!a.WeeklyReset.IsZero() && a.WeeklyReset.After(now) && a.WeeklyReset.Sub(now) <= 24*time.Hour && a.Weekly <= 50)
	}
	if in.AutoSwitch && cur.Peak >= in.Threshold {
		var best *Account
		for i := range in.Accounts {
			a := &in.Accounts[i]
			if usable(a) && (best == nil || a.Peak < best.Peak) {
				best = a
			}
		}
		if best != nil {
			return best.ID, NearlyFull
		}
	}
	if in.SpendWeekly && now.Sub(in.HandSwitch) >= 5*time.Hour && now.Sub(in.LastChat) >= 15*time.Minute && !spendable(cur) {
		var best *Account
		for i := range in.Accounts {
			a := &in.Accounts[i]
			if usable(a) && spendable(a) && (best == nil || a.WeeklyReset.Before(best.WeeklyReset)) {
				best = a
			}
		}
		if best != nil {
			return best.ID, Weekly
		}
	}
	return "", Manual
}
