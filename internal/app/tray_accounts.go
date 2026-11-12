package app

import (
	"fmt"
	"strings"
	"time"
)

// trayAccountEntry keeps the native menu's presentation and guarded action
// together. The switch service revalidates live state when a stale menu is used.
type trayAccountEntry struct {
	label         string
	enabled       bool
	selectAccount func()
}

func trayAccountEntries(snap snapshot, updating bool, now time.Time, switchAccount func(string) error, report func(string)) []trayAccountEntry {
	entries := make([]trayAccountEntry, 0, len(snap.Accounts))
	for _, account := range snap.Accounts {
		identity := account.Email
		if identity == "" {
			identity = account.Name
		}
		if identity == "" {
			identity = tr("Account", "账号")
		}
		active := account.UUID == snap.Active
		if active {
			identity += " · " + tr("Active", "当前账号")
		}
		detail := usageText(account, snap.Threshold, now)
		// Keep this quick-switch menu compact; reset dates remain in the full panel.
		if account.Problem == "" && account.Usage != nil {
			usage := account.Usage.current(now)
			detail = fmt.Sprintf(tr("5h %.0f%% · week %.0f%%", "5小时 %.0f%% · 本周 %.0f%%"), usage.Session, usage.Weekly)
		}
		// Native menu labels must not interpret control characters from profile data.
		label := strings.Join(strings.Fields(identity+" — "+detail), " ")
		enabled := !active && !snap.Busy && !updating
		id := account.UUID
		entries = append(entries, trayAccountEntry{label: label, enabled: enabled, selectAccount: func() {
			if !enabled {
				return
			}
			if err := switchAccount(id); err != nil {
				report(err.Error())
			}
		}})
	}
	return entries
}
