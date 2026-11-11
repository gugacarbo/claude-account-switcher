package main

import (
	"fmt"
	"runtime"
	"strings"
	"time"
)

func appName() string { return tr("Claude Account Switcher", "Claude 账号切换器") }

// menuTab right-aligns the usage on Windows, where a tab in a menu title
// starts a right-aligned column.
var menuTab = map[bool]string{true: "\t", false: "    "}[runtime.GOOS == "windows"]

func usageText(a Account, threshold float64, now time.Time) string {
	if a.Problem == signedOut {
		return tr(signedOut, "登录已失效，请重新添加")
	}
	if a.Problem != "" {
		return a.Problem
	}
	if a.Usage == nil {
		return tr("usage unknown", "用量未知")
	}
	u := a.Usage.current(now)
	parts := []string{fmt.Sprintf(tr("5h %.0f%%", "5小时 %.0f%%"), u.Session), fmt.Sprintf(tr("week %.0f%%", "本周 %.0f%%"), u.Weekly)}
	parts[0] += resetPart(u.Session, u.SessionReset, threshold, now)
	// The weekly reset is always shown: it decides how much of the week is left to use.
	parts[1] += resetPart(u.Weekly, u.WeeklyReset, threshold, now)
	return strings.Join(parts, " · ")
}

// resetPart says when a limit resets: "until" once it is at the threshold,
// so it reads as blocked until then.
func resetPart(pct float64, at time.Time, threshold float64, now time.Time) string {
	switch {
	case at.IsZero() || !at.After(now):
		return ""
	case pct >= threshold:
		return fmt.Sprintf(tr(" until %s", "，%s 才重置"), resetText(at, now))
	}
	return fmt.Sprintf(tr(", resets %s", "，%s 重置"), resetText(at, now))
}

var weekdays = [...]string{"周日", "周一", "周二", "周三", "周四", "周五", "周六"}

func resetText(at, now time.Time) string {
	at, now = at.Local(), now.Local()
	switch {
	case at.YearDay() == now.YearDay() && at.Year() == now.Year():
		return at.Format("15:04")
	case at.Sub(now) < 6*24*time.Hour:
		return tr(at.Format("Mon 15:04"), weekdays[at.Weekday()]+" "+at.Format("15:04"))
	}
	// A weekday alone would read as today for a reset a week out.
	return tr(at.Format("Mon 2 Jan 15:04"), at.Format("1月2日 ")+weekdays[at.Weekday()]+" "+at.Format("15:04"))
}
