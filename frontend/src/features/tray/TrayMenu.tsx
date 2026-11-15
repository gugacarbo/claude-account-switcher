import { useEffect, useRef, useState } from "react";
import type { Account, UIState } from "../../bridge";
import type { T } from "../../shared/i18n";

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
  const accounts = state?.accounts ?? [];
  const disabled = pending || !!state?.busy;

  // Roving focus for real keyboard navigation across the menu.
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [cursor, setCursor] = useState(0);

  const loading = state === null;
  // Focus the first enabled row once the account list is on screen.
  useEffect(() => {
    if (loading || accounts.length === 0) return;
    const index = itemRefs.current.findIndex((el) => el && !el.disabled);
    if (index >= 0) {
      itemRefs.current[index]?.focus();
      setCursor(index);
    }
  }, [loading, accounts.length]);

  // Roving focus skips disabled entries (the active account and, while busy,
  // every row), wrapping around the list.
  const step = (from: number, delta: 1 | -1) => {
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
        return move(step(cursor, 1));
      case "ArrowUp":
        return move(step(cursor, -1));
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
                      {account.email}
                      {account.usage ? (
                        <span className="tray-account-usage">
                          {t(
                            `5h ${account.usage.session}% · week ${account.usage.weekly}%`,
                            `5小时 ${account.usage.session}% · 每周 ${account.usage.weekly}%`,
                          )}
                        </span>
                      ) : null}
                    </span>
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
