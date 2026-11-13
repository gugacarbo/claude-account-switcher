import { useEffect, useRef } from "react";
import type { Bridge } from "../../bridge";

// The tray dropdown is its own frameless window (?view=menu), so it keeps the
// app styling instead of the host menu implementation. It stays deliberately
// small: open the panel or quit. Everything else lives inside the panel.
export function TrayMenu({ bridge, lang }: { bridge: Bridge; lang: string }) {
  const t = (en: string, zh: string) => (lang === "zh-CN" ? zh : en);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  // Failures stay silent on purpose: the window closes itself when a command
  // cannot run, and there is no room for an error banner in a dropdown.
  const run = (method: string, ...args: unknown[]) => {
    void bridge.call(method, ...args).catch(() => {});
  };
  return (
    <div
      className="tray-menu"
      role="menu"
      aria-label={t("Application menu", "应用菜单")}
    >
      <button
        ref={first}
        type="button"
        role="menuitem"
        className="tray-menu-item"
        onClick={() => run("OpenWindow", "panel")}
      >
        {t("Open", "打开")}
      </button>
      <hr className="tray-menu-separator" />
      <button
        type="button"
        role="menuitem"
        className="tray-menu-item"
        onClick={() => run("Quit")}
      >
        {t("Quit", "退出")}
      </button>
    </div>
  );
}
