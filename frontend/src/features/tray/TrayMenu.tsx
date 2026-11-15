import { useEffect, useRef } from "react";
import type { Account, Bridge, UIState } from "../../bridge";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Separator } from "../../components/ui/separator";
import type { T } from "../../shared/i18n";

// The tray dropdown is its own frameless window (?view=menu), so it keeps the
// app styling instead of the host menu implementation. It lists the accounts
// with their usage so one click switches, then opens the panel or quits.
// The window height is computed in Go (menuHeight in desktop_runtime.go) from
// the fixed row heights of .tray-menu* in style.css; keep them in sync.
export function TrayMenu({
  bridge,
  state,
}: {
  bridge: Bridge;
  state: UIState | null;
}) {
  const t: T = (en, zh) => (state?.lang === "zh-CN" ? zh : en);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  // Failures stay silent on purpose: the window closes itself when a command
  // cannot run, and there is no room for an error banner in a dropdown.
  const run = (method: string, ...args: unknown[]) =>
    bridge.call(method, ...args).catch(() => {});
  const switchTo = (account: Account) => {
    void run("SwitchAccount", account.id).then(() =>
      run("CloseWindow", "menu"),
    );
  };
  const accounts = state?.accounts ?? [];
  // Two sign-ins often share a display name; the email tells them apart.
  const label = (a: Account) =>
    a.name && accounts.filter((other) => other.name === a.name).length === 1
      ? a.name
      : a.email || a.name;
  const busy = !!state?.busy;
  return (
    <div
      className="tray-menu"
      role="menu"
      aria-label={t("Application menu", "应用菜单")}
    >
      <p className="tray-menu-heading" aria-live="polite">
        {busy ? t("Switching…", "正在切换…") : t("Accounts", "账号")}
      </p>
      <div className="tray-menu-accounts">
        {accounts.length ? (
          accounts.map((a) => (
            <Button
              key={a.id}
              type="button"
              variant="ghost"
              role="menuitemradio"
              aria-checked={a.active}
              className={`tray-menu-account ${a.active ? "active" : ""}`}
              disabled={busy && !a.active}
              onClick={() =>
                a.active ? run("CloseWindow", "menu") : switchTo(a)
              }
            >
              <Avatar className="tray-menu-avatar" aria-hidden="true">
                <AvatarFallback>
                  {(label(a) || "?").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="tray-menu-identity">
                <strong>{label(a)}</strong>
                <small>{usageSummary(a, t)}</small>
              </span>
              {a.active ? (
                <span className="tray-menu-check" aria-hidden="true">
                  ●
                </span>
              ) : null}
            </Button>
          ))
        ) : (
          <p className="tray-menu-empty">
            {t("No accounts yet", "还没有账号")}
          </p>
        )}
      </div>
      <Separator className="tray-menu-separator" />
      <Button
        ref={first}
        type="button"
        variant="ghost"
        role="menuitem"
        className="tray-menu-item"
        onClick={() => void run("OpenWindow", "panel")}
      >
        {t("Open", "打开")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        role="menuitem"
        className="tray-menu-item"
        onClick={() => void run("Quit")}
      >
        {t("Quit", "退出")}
      </Button>
    </div>
  );
}

function usageSummary(a: Account, t: T) {
  if (!a.usage) return a.email || t("Usage unavailable", "用量未知");
  return t(
    `5h ${Math.round(a.usage.session)}% · Week ${Math.round(a.usage.weekly)}%`,
    `5 小时 ${Math.round(a.usage.session)}% · 每周 ${Math.round(a.usage.weekly)}%`,
  );
}
