import { useRef, useState } from "react";
import type { Account, UIState } from "../../bridge";
import { Progress } from "../../components/ui/progress";
import type { T } from "../../shared/i18n";

function remainingTime(
  reset: string,
  now: number,
  fullMinutes = false,
): string | null {
  if (!reset) return null;
  const timestamp = Date.parse(reset);
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.max(0, Math.ceil((timestamp - now) / 60_000));
  if (minutes === 0) return "now";
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  const minuteUnit = fullMinutes ? "min" : "m";
  if (days > 0) return `${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours > 0) return `${hours}h${rest ? ` ${rest}${minuteUnit}` : ""}`;
  return `${rest}${minuteUnit}`;
}

// Absolute reset clock for the hover details: local HH:MM, prefixed with
// DD/MM when the reset falls on a different local day than today.
function resetSuffix(reset: string, now: number, t: T): string {
  if (!reset) return "";
  const timestamp = Date.parse(reset);
  if (!Number.isFinite(timestamp)) return "";
  if (timestamp <= now) return t(" · reset now", " · 现在重置");
  const date = new Date(timestamp);
  const today = new Date(now);
  const pad = (value: number) => String(value).padStart(2, "0");
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const sameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const when = sameDay
    ? clock
    : `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${clock}`;
  return t(` · reset ${when}`, ` · ${when}重置`);
}

function TrayMeter({
  label,
  value,
  reset,
}: {
  label: string;
  value: number;
  reset: string;
}) {
  return (
    <span className="tray-account-meter">
      <span>{Math.round(value)}%</span>
      <Progress
        max={100}
        value={Math.max(0, Math.min(value, 100))}
        aria-label={label}
      />
      <span>{remainingTime(reset, Date.now(), true) ?? "—"}</span>
    </span>
  );
}

// The tray dropdown is its own frameless window (?view=menu). App keeps the
// signed UIState and the switch error; this component only renders it. Switch
// success never hides the menu: the list stays up so the user sees the new
// active account highlighted before the dropdown closes.
export function TrayMenu({
  state,
  lang,
  pending,
  error,
  onSwitch,
  onOpenPanel,
  onQuit,
  onEscape,
}: {
  state: UIState | null;
  lang: string;
  pending: boolean;
  error: string;
  onSwitch: (id: string) => void;
  onOpenPanel: () => void;
  onQuit: () => void;
  onEscape?: () => void;
}) {
  const t: T = (en, zh) => (lang === "zh-CN" ? zh : en);
  // The active account always leads the list; the rest keeps backend order
  // (Array.prototype.sort is stable).
  const accounts = [...(state?.accounts ?? [])].sort(
    (a, b) => Number(b.active) - Number(a.active),
  );
  const disabled = pending || !!state?.busy;

  // Roving focus for real keyboard navigation across the menu.
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [cursor, setCursor] = useState(-1);

  const loading = state === null;

  // Roving focus skips disabled entries (the active account and, while busy,
  // every row), wrapping around the list.
  const step = (from: number, delta: 1 | -1) => {
    if (from < 0) {
      for (let i = 0; i < accounts.length; i++) {
        const index = delta === 1 ? i : accounts.length - 1 - i;
        const el = itemRefs.current[index];
        if (el && !el.disabled) return index;
      }
      return -1;
    }
    for (let i = 1; i <= accounts.length; i++) {
      const index = (from + delta * i + accounts.length * i) % accounts.length;
      const el = itemRefs.current[index];
      if (el && !el.disabled) return index;
    }
    return -1;
  };

  const focusAt = (index: number) => {
    const el = itemRefs.current[index];
    if (el) {
      el.focus();
      setCursor(index);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape?.();
      return;
    }
    if (disabled || accounts.length === 0) return;
    const move = (index: number) => {
      event.preventDefault();
      if (index >= 0) focusAt(index);
    };
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        const focused = itemRefs.current.findIndex(
          (el) => el === document.activeElement,
        );
        return move(
          step(
            focused >= 0 ? focused : cursor,
            event.key === "ArrowDown" ? 1 : -1,
          ),
        );
      }
      case "Home": {
        const first = itemRefs.current.findIndex((el) => el && !el.disabled);
        return move(first);
      }
      case "End": {
        for (let i = accounts.length - 1; i >= 0; i--) {
          const el = itemRefs.current[i];
          if (el && !el.disabled) return move(i);
        }
        return;
      }
      default:
        return;
    }
  };

  return (
    <div
      className="tray-menu"
      role="menu"
      aria-label={t("Application menu", "应用菜单")}
      onKeyDown={onKeyDown}
    >
      {state === null ? (
        <p role="status" className="tray-menu-status">
          {t("Connecting to your accounts…", "正在连接账号…")}
        </p>
      ) : (
        <>
          {error ? (
            <p className="notice error tray-menu-error" role="alert">
              {error}
            </p>
          ) : null}
          {state.busy ? (
            <p role="status" className="tray-menu-status">
              {t("Working on it…", "正在处理…")}
            </p>
          ) : null}
          {accounts.length === 0 ? (
            <p className="tray-menu-status">
              {t("No accounts yet", "还没有账号")}
            </p>
          ) : (
            <div className="tray-accounts">
              {accounts.map((account: Account, index) => {
                const label = account.name || account.email;
                return (
                  <button
                    key={account.id}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                      return;
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={account.active}
                    className={`tray-account ${account.active ? "active" : ""}`}
                    disabled={account.active || disabled}
                    onFocus={() => setCursor(index)}
                    onClick={() => onSwitch(account.id)}
                  >
                    <span className="tray-account-head">
                      <strong>{label}</strong>
                      <span className="plan">{account.plan}</span>
                      {account.active ? (
                        <span className="tray-account-flag">
                          ● {t("Active", "当前")}
                        </span>
                      ) : null}
                    </span>
                    <span className="tray-account-sub">
                      <span className="tray-account-email">
                        {account.email}
                      </span>
                      {account.usage ? (
                        <span className="tray-account-limits">
                          <span>
                            {t(
                              `5h ${account.usage.session}%${resetSuffix(account.usage.sessionReset, Date.now(), t)}`,
                              `5小时 ${account.usage.session}%${resetSuffix(account.usage.sessionReset, Date.now(), t)}`,
                            )}
                          </span>
                          <span>
                            {t(
                              `week ${account.usage.weekly}%${resetSuffix(account.usage.weeklyReset, Date.now(), t)}`,
                              `每周 ${account.usage.weekly}%${resetSuffix(account.usage.weeklyReset, Date.now(), t)}`,
                            )}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    {account.usage ? (
                      <span className="tray-account-meters">
                        <TrayMeter
                          label={t("5-hour usage", "5小时用量")}
                          value={account.usage.session}
                          reset={account.usage.sessionReset}
                        />
                        <TrayMeter
                          label={t("Weekly usage", "每周用量")}
                          value={account.usage.weekly}
                          reset={account.usage.weeklyReset}
                        />
                      </span>
                    ) : null}
                    {pending && !account.active ? (
                      <span className="tray-account-pending">
                        {t("Switching…", "切换中…")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
          <hr className="tray-menu-separator" />
          <button
            type="button"
            role="menuitem"
            className="tray-menu-item"
            onClick={onOpenPanel}
          >
            {t("Open panel", "打开面板")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="tray-menu-item"
            onClick={onQuit}
          >
            {t("Quit", "退出")}
          </button>
        </>
      )}
    </div>
  );
}
