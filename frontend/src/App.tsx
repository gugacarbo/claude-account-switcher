import { useEffect, useState } from "react";
import type { Bridge, UIState } from "./bridge";
import { Alert } from "./components/ui/alert";
import { Button } from "./components/ui/button";
import { SettingsIcon } from "./shared/Icons";
import { WindowHeader } from "./shared/WindowHeader";
import "./style.css";

import { AccountCard } from "./features/accounts/AccountCard";
import { Resume } from "./features/resume/Resume";
import { Settings } from "./features/settings/Settings";
import { Threshold } from "./features/settings/Threshold";
import { TrayMenu } from "./features/tray/TrayMenu";
import type { T } from "./shared/i18n";

type Screen = "panel" | "settings" | "threshold";

function isScreen(value: string): value is Screen {
  return value === "panel" || value === "settings" || value === "threshold";
}

export function App({
  bridge,
  view = "panel",
}: {
  bridge: Bridge;
  view?: string;
}) {
  // Only the resume prompt is a separate native window; the panel hosts the
  // accounts, settings, and threshold sections, reached in place or via the
  // desktop "navigate" event. Legacy ?view= deep links keep working.
  const unified = view === "panel";
  const [screen, setScreen] = useState<Screen>("panel");
  const [state, setState] = useState<UIState | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const active: Screen | "resume" =
    view === "resume"
      ? "resume"
      : unified
        ? screen
        : isScreen(view)
          ? view
          : "panel";
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
  useEffect(() => {
    if (!unified || !bridge.subscribeNavigation) return;
    const off = bridge.subscribeNavigation((section) => {
      // The bridge already filters payloads; guard again so an unexpected
      // value can never force an invalid screen.
      if (isScreen(section)) setScreen(section);
    });
    return off;
  }, [bridge, unified]);
  const t: T = (en, zh) => (state?.lang === "zh-CN" ? zh : en);
  // A manual switch can ask for confirmation before Claude is restarted. Keep
  // that decision in the tray instead of opening a second window.
  if (view === "menu" && state?.resume) {
    const prompt = state.resume;
    const cancel = () => void act("CancelResume", prompt.id);
    return (
      <main className="app resume tray-resume">
        <WindowHeader
          title={t("Confirm account switch", "确认切换账号")}
          t={t}
          onClose={cancel}
        />
        {error ? <Alert className="notice error">{error}</Alert> : null}
        <Resume
          prompt={prompt}
          t={t}
          disabled={pending}
          act={(method, ...args) =>
            method === "CloseWindow" && args[0] === "resume"
              ? act("CloseWindow", "menu")
              : act(method, ...args)
          }
          onCancel={cancel}
          cancelLabel={t("Cancel switch", "取消切换")}
        />
      </main>
    );
  }
  // The tray dropdown is its own small window: it renders from the same signed
  // UIState and shares the pending/error handling, but without header or
  // panel sections.
  if (view === "menu") {
    return (
      <TrayMenu
        state={state}
        lang={state?.lang ?? "en"}
        pending={pending}
        error={error}
        onSwitch={(id) => void act("SwitchAccount", id)}
        onOpenPanel={() => void act("OpenWindow", "panel")}
        onQuit={() => void act("Quit")}
        onEscape={() => void act("CloseWindow", "menu").catch(() => {})}
      />
    );
  }
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
  // The resume prompt lives in its own native window; closing from any other
  // screen always targets the unified panel window.
  const close = () =>
    act("CloseWindow", active === "resume" ? "resume" : "panel");
  const goBack = () => setScreen(active === "threshold" ? "settings" : "panel");
  const title =
    active === "settings"
      ? t("Make it work for you", "按你的方式运行")
      : active === "threshold"
        ? t("Choose your limit", "设置切换阈值")
        : active === "resume"
          ? t("Pick up where you left off", "继续未完成的工作")
          : t("A little more room.", "留出更多空间。");
  return (
    <main className={`app ${active}`}>
      <WindowHeader
        title={title}
        t={t}
        onClose={close}
        onBack={unified && active !== "panel" ? goBack : undefined}
      >
        {active === "panel" ? (
          <Button
            type="button"
            variant="ghost"
            className="window-header-button"
            aria-label={t("Settings", "设置")}
            onClick={() =>
              unified ? setScreen("settings") : act("OpenWindow", "settings")
            }
          >
            <SettingsIcon />
          </Button>
        ) : null}
      </WindowHeader>
      {error ? (
        <Alert className="notice error">
          {error}
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              bridge
                .state()
                .then(setState)
                .catch((e) => setError(String(e)))
            }
          >
            {t("Retry", "重试")}
          </Button>
        </Alert>
      ) : null}
      {!state ? (
        <p role="status" className="loading">
          {t("Connecting to your accounts…", "正在连接账号…")}
        </p>
      ) : (
        <>
          {active === "settings" ? (
            <Settings
              state={state}
              t={t}
              disabled={disabled}
              act={act}
              onOpenThreshold={
                unified
                  ? () => setScreen("threshold")
                  : undefined /* standalone window keeps the desktop call */
              }
            />
          ) : active === "threshold" ? (
            <Threshold
              key={state.threshold}
              state={state}
              t={t}
              disabled={disabled}
              act={act}
              onCancel={unified ? () => setScreen("settings") : undefined}
              onComplete={unified ? () => setScreen("settings") : undefined}
            />
          ) : active === "resume" ? (
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
                <Alert className="notice" role="status">
                  {state.status}
                </Alert>
              ) : state.note ? (
                <Alert className="notice" role="none">
                  {state.note}
                </Alert>
              ) : null}
              {state.busy ? (
                <Alert className="notice" role="status">
                  {t(
                    "Working on it. Your sign-ins are kept safe.",
                    "正在处理，登录信息会安全保留。",
                  )}
                </Alert>
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
              <Button
                type="button"
                variant="ghost"
                className="add-button"
                aria-label={t("Add account", "添加账号")}
                disabled={disabled}
                onClick={() => act("AddAccount")}
              >
                ＋ {t("Add account", "添加账号")}
              </Button>
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
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  onClick={() =>
                    unified
                      ? setScreen("settings")
                      : act("OpenWindow", "settings")
                  }
                >
                  {t("Manage", "管理")}
                </Button>
              </div>
              {state.update ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="update-button"
                  disabled={disabled}
                  onClick={() => act("InstallUpdate")}
                >
                  {t(
                    `Version ${state.update} is ready. Update & restart →`,
                    `版本 ${state.update} 已就绪。更新并重启 →`,
                  )}
                </Button>
              ) : null}
              <footer>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-button"
                  disabled={disabled}
                  onClick={() => act("ImportChats")}
                >
                  {t("Import chats", "导入聊天")}
                </Button>
                <span className="footer-end">
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-button"
                    onClick={() => act("OpenDataFolder")}
                  >
                    {t("Data folder", "数据文件夹")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-button"
                    disabled={disabled}
                    onClick={() => act("Quit")}
                  >
                    {t("Quit", "退出")}
                  </Button>
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
