import { useEffect, useState } from "react";
import type { Bridge, UIState } from "./bridge";
import "./style.css";

import { AccountCard } from "./features/accounts/AccountCard";
import { Resume } from "./features/resume/Resume";
import { Settings } from "./features/settings/Settings";
import { Threshold } from "./features/settings/Threshold";
import type { T } from "./shared/i18n";

export function App({
  bridge,
  view = "panel",
}: {
  bridge: Bridge;
  view?: string;
}) {
  const [state, setState] = useState<UIState | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    let live = true;
    let off = () => {};
    const reload = () => {
      bridge
        .state()
        .then((value) => {
          if (live) {
            setState(value);
            document.documentElement.lang = value.lang;
          }
        })
        .catch((e) => {
          if (live) setError(String(e.message ?? e));
        });
    };
    try {
      off = bridge.subscribe(reload);
    } catch (e) {
      setError(String(e));
    }
    reload();
    return () => {
      live = false;
      off();
    };
  }, [bridge]);
  const t: T = (en, zh) => (state?.lang === "zh-CN" ? zh : en);
  async function act(method: string, ...args: unknown[]) {
    setPending(true);
    setError("");
    try {
      await bridge.call(method, ...args);
      setState(await bridge.state());
      return true;
    } catch (e) {
      setError(String((e as Error).message ?? e));
      return false;
    } finally {
      setPending(false);
    }
  }
  const disabled = pending || !!state?.busy;
  return (
    <main className={`app ${view}`}>
      <header className="header">
        <div className="brand-mark" aria-hidden="true">
          ◉
        </div>
        <div className="brand-copy">
          <span className="eyebrow">ACCOUNT SWITCHER</span>
          <h1>
            {view === "settings"
              ? t("Make it work for you", "按你的方式运行")
              : view === "threshold"
                ? t("Choose your limit", "设置切换阈值")
                : view === "resume"
                  ? t("Pick up where you left off", "继续未完成的工作")
                  : t("A little more room.", "留出更多空间。")}
          </h1>
        </div>
        {view === "panel" ? (
          <button
            type="button"
            className="icon-button"
            aria-label={t("Settings", "设置")}
            onClick={() => act("OpenWindow", "settings")}
          >
            ⚙
          </button>
        ) : (
          <button
            type="button"
            className="icon-button"
            aria-label={t("Close", "关闭")}
            onClick={() => act("CloseWindow", view)}
          >
            ×
          </button>
        )}
      </header>
      {error ? (
        <div className="notice error" role="alert">
          {error}
          <button
            type="button"
            onClick={() =>
              bridge
                .state()
                .then(setState)
                .catch((e) => setError(String(e)))
            }
          >
            {t("Retry", "重试")}
          </button>
        </div>
      ) : null}
      {!state ? (
        <p role="status" className="loading">
          {t("Connecting to your accounts…", "正在连接账号…")}
        </p>
      ) : (
        <>
          {view === "settings" ? (
            <Settings state={state} t={t} disabled={disabled} act={act} />
          ) : view === "threshold" ? (
            <Threshold
              key={`${state.thresholdOpening}:${state.threshold}`}
              state={state}
              t={t}
              disabled={disabled}
              act={act}
            />
          ) : view === "resume" ? (
            <Resume
              key={state.resume?.id ?? "none"}
              prompt={state.resume}
              t={t}
              disabled={pending}
              act={act}
            />
          ) : (
            <>
              <div className="section-heading">
                <h2>{t("Your accounts", "你的账号")}</h2>
                <span>
                  {state.accounts.length} {t("connected", "已连接")}
                </span>
              </div>
              {state.status ? (
                <p className="notice" role="status">
                  {state.status}
                </p>
              ) : state.note ? (
                <p className="notice">{state.note}</p>
              ) : null}
              {state.busy ? (
                <p className="notice" role="status">
                  {t(
                    "Working on it. Your sign-ins are kept safe.",
                    "正在处理，登录信息会安全保留。",
                  )}
                </p>
              ) : null}
              <section className="accounts" aria-label={t("Accounts", "账号")}>
                {state.accounts.length ? (
                  state.accounts.map((a) => (
                    <AccountCard
                      key={a.id}
                      account={a}
                      threshold={state.threshold}
                      t={t}
                      disabled={disabled}
                      onSwitch={() => act("SwitchAccount", a.id)}
                    />
                  ))
                ) : (
                  <div className="empty">
                    <span aria-hidden="true">＋</span>
                    <h2>
                      {t("Room for your first account", "添加你的第一个账号")}
                    </h2>
                    <p>
                      {t(
                        "Open Claude and sign in. Your account and usage will appear here automatically.",
                        "打开 Claude 并登录，账号和用量将自动显示在这里。",
                      )}
                    </p>
                  </div>
                )}
              </section>
              <button
                type="button"
                className="add-button"
                aria-label={t("Add account", "添加账号")}
                disabled={disabled}
                onClick={() => act("AddAccount")}
              >
                ＋ {t("Add account", "添加账号")}
              </button>
              <div className="automation">
                <span
                  className={`status-dot ${state.autoSwitch ? "on" : ""}`}
                />
                <div>
                  <strong>
                    {state.autoSwitch
                      ? t("Auto-switch is on", "自动切换已开启")
                      : t("You’re in control", "由你掌控")}
                  </strong>
                  <p>
                    {state.autoSwitch
                      ? t(
                          `We’ll switch at ${state.threshold}% usage.`,
                          `用量达到 ${state.threshold}% 时切换。`,
                        )
                      : t(
                          "Switch accounts whenever you need.",
                          "随时手动切换账号。",
                        )}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => act("OpenWindow", "settings")}
                >
                  {t("Manage", "管理")}
                </button>
              </div>
              {state.update ? (
                <button
                  type="button"
                  className="update-button"
                  disabled={disabled}
                  onClick={() => act("InstallUpdate")}
                >
                  {t(
                    `Version ${state.update} is ready. Update & restart →`,
                    `版本 ${state.update} 已就绪。更新并重启 →`,
                  )}
                </button>
              ) : null}
              <footer>
                <button
                  type="button"
                  className="text-button"
                  disabled={disabled}
                  onClick={() => act("ImportChats")}
                >
                  {t("Import chats", "导入聊天")}
                </button>
                <span className="footer-end">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => act("OpenDataFolder")}
                  >
                    {t("Data folder", "数据文件夹")}
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    disabled={disabled}
                    onClick={() => act("Quit")}
                  >
                    {t("Quit", "退出")}
                  </button>
                </span>
              </footer>
            </>
          )}
          <p className="signature">
            {t(
              "Independent utility · Not affiliated with Anthropic",
              "独立工具 · 与 Anthropic 无关联",
            )}{" "}
            <span>v{state.version}</span>
          </p>
        </>
      )}
    </main>
  );
}
