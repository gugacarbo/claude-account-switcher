import { useEffect, useState } from "react";
import type { Account, Bridge, Prompt, UIState } from "./bridge";
import "./style.css";

type T = (en: string, zh: string) => string;
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
    <main className={"app " + view}>
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
            className="icon-button"
            aria-label={t("Settings", "设置")}
            onClick={() => act("OpenWindow", "settings")}
          >
            ⚙
          </button>
        ) : (
          <button
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
                className="add-button"
                aria-label={t("Add account", "添加账号")}
                disabled={disabled}
                onClick={() => act("AddAccount")}
              >
                ＋ {t("Add account", "添加账号")}
              </button>
              <div className="automation">
                <span
                  className={"status-dot " + (state.autoSwitch ? "on" : "")}
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
                  className="text-button"
                  onClick={() => act("OpenWindow", "settings")}
                >
                  {t("Manage", "管理")}
                </button>
              </div>
              {state.update ? (
                <button
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
                  className="text-button"
                  disabled={disabled}
                  onClick={() => act("ImportChats")}
                >
                  {t("Import chats", "导入聊天")}
                </button>
                <span className="footer-end">
                  <button
                    className="text-button"
                    onClick={() => act("OpenDataFolder")}
                  >
                    {t("Data folder", "数据文件夹")}
                  </button>
                  <button
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
function AccountCard({
  account: a,
  threshold,
  t,
  disabled,
  onSwitch,
}: {
  account: Account;
  threshold: number;
  t: T;
  disabled: boolean;
  onSwitch: () => void;
}) {
  return (
    <article className={"account-card " + (a.active ? "active" : "")}>
      <div className="account-heading">
        <div className="avatar" aria-hidden="true">
          {(a.name || a.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="account-identity">
          <h3>{a.name || a.email}</h3>
          <p>{a.email}</p>
        </div>
        <span className="plan">{a.plan}</span>
      </div>
      {a.usage ? (
        <div className="usage-grid">
          <Meter
            label={t("5-hour limit", "5 小时额度")}
            value={a.usage.session}
            reset={a.usage.sessionReset}
            threshold={threshold}
            t={t}
          />
          <Meter
            label={t("Weekly limit", "每周额度")}
            value={a.usage.weekly}
            reset={a.usage.weeklyReset}
            threshold={threshold}
            t={t}
          />
        </div>
      ) : null}
      <div className="account-bottom">
        {a.active ? (
          <span className="active-label">
            ● {t("Active account", "当前账号")}
          </span>
        ) : (
          <span className="muted">{t("Ready when you are", "随时可切换")}</span>
        )}
        {!a.active ? (
          <button
            className="switch-button"
            aria-label={t(
              `Switch to ${a.name || a.email}`,
              `切换到 ${a.name || a.email}`,
            )}
            disabled={disabled}
            onClick={onSwitch}
          >
            {t("Switch", "切换")} <span aria-hidden="true">↗</span>
          </button>
        ) : null}
      </div>
      <p className="account-detail">{a.detail}</p>
    </article>
  );
}
function Meter({
  label,
  value,
  reset,
  threshold,
  t,
}: {
  label: string;
  value: number;
  reset: string;
  threshold: number;
  t: T;
}) {
  const valid = reset && !reset.startsWith("0001");
  return (
    <div className="meter">
      <div className="meter-heading">
        <span>{label}</span>
        <strong>
          {Math.round(value)}
          <small>%</small>
        </strong>
      </div>
      <progress
        className={value >= threshold ? "full" : value >= 75 ? "warn" : ""}
        max={100}
        value={Math.max(0, Math.min(value, 100))}
        aria-label={label}
      />
      <span className="reset">
        {valid
          ? t("Resets ", "重置于 ") +
            new Date(reset).toLocaleString(document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'en', {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : t("Reset time unavailable", "重置时间未知")}
      </span>
    </div>
  );
}
function Settings({
  state: s,
  t,
  disabled,
  act,
}: {
  state: UIState;
  t: T;
  disabled: boolean;
  act: (method: string, ...args: unknown[]) => Promise<boolean>;
}) {
  const options: [keyof UIState, string, string, string, string][] = [
    [
      "autoSwitch",
      "Auto-switch when nearly full",
      "额度快用完时自动切换",
      "Move to the account with the most room left.",
      "切换到剩余额度最多的账号。",
    ],
    [
      "spendWeekly",
      "Use expiring weekly allowance",
      "使用即将重置的周额度",
      "Use spare weekly allowance before it resets.",
      "在重置之前使用剩余的周额度。",
    ],
    [
      "sshImport",
      "Import chats from SSH hosts",
      "从 SSH 主机导入聊天",
      "Read chats over your own SSH connection.",
      "通过你自己的 SSH 连接读取聊天。",
    ],
    [
      "autostart",
      "Start at login",
      "开机时启动",
      "Quietly stay ready in your system tray.",
      "安静地在系统托盘中待命。",
    ],
  ];
  return (
    <>
      <p className="intro">
        {t(
          "Less interruption. More time for the work.",
          "减少打断，专注工作。",
        )}
      </p>
      <section className="settings-card">
        {options.map(([key, en, zh, desc, descZH]) => (
          <label className="setting" key={key}>
            <span>
              <strong>{t(en, zh)}</strong>
              <small>{t(desc, descZH)}</small>
            </span>
            <input
              type="checkbox"
              aria-label={t(en, zh)}
              checked={Boolean(s[key])}
              disabled={disabled}
              onChange={(e) => act("SetOption", key, e.target.checked)}
            />
          </label>
        ))}
      </section>
      <button
        className="threshold-link"
        onClick={() => act("OpenWindow", "threshold")}
      >
        <span>
          {t("Auto-switch threshold", "自动切换阈值")}
          <small>{t("5-hour or weekly usage", "5 小时或每周用量")}</small>
        </span>
        <strong>{s.threshold}% →</strong>
      </button>
      <p className="fine-print">
        {t(
          "Closing this window keeps monitoring and automations running. Use Quit in the account panel to stop the app.",
          "关闭此窗口后监控和自动化仍会运行。请在账号面板中选择退出以停止应用。",
        )}
      </p>
    </>
  );
}
function Threshold({
  state,
  t,
  disabled,
  act,
}: {
  state: UIState;
  t: T;
  disabled: boolean;
  act: (method: string, ...args: unknown[]) => Promise<boolean>;
}) {
  const [value, setValue] = useState(String(state.threshold));
  const n = Number(value),
    valid = /^\d{1,2}$/.test(value) && n >= 1 && n <= 99;
  return (
    <>
      <p className="intro">
        {t(
          "Switch when the active account reaches this much of its 5-hour or weekly allowance.",
          "当当前账号的 5 小时或每周用量达到此百分比时切换。",
        )}
      </p>
      <section className="threshold-card">
        <label className="threshold-value">
          <input
            type="number"
            min="1"
            max="99"
            step="1"
            aria-label={t("Threshold in percent", "阈值百分比")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span>%</span>
        </label>
        <input
          type="range"
          min="1"
          max="99"
          value={valid ? n : 1}
          aria-label={t("Threshold slider", "阈值滑块")}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="presets">
          {[90, 94, 96, 98].map((p) => (
            <button
              className={n === p ? "selected" : ""}
              key={p}
              onClick={() => setValue(String(p))}
            >
              {p}%
            </button>
          ))}
        </div>
      </section>
      <p className="fine-print" role="status">
        {!valid
          ? t(
              "Enter a whole number from 1 to 99.",
              "请输入 1 到 99 之间的整数。",
            )
          : n > 10
            ? t(
                `Only accounts below ${n - 10}% are eligible, so we won’t bounce between nearly full ones.`,
                `仅切换到用量低于 ${n - 10}% 的账号，避免在快满的账号之间来回切换。`,
              )
            : t(
                "No account can be 10 points below this limit, so automatic switching will not occur.",
                "没有账号能比此阈值低 10 个百分点，因此不会自动切换。",
              )}
      </p>
      <div className="actions">
        <button
          className="secondary"
          onClick={() => act("CloseWindow", "threshold")}
        >
          {t("Cancel", "取消")}
        </button>
        <button
          className="primary"
          disabled={!valid || disabled}
          onClick={async () => {
            if (await act("SetThreshold", n))
              await act("CloseWindow", "threshold");
          }}
        >
          {t("Set threshold", "设置阈值")}
        </button>
      </div>
    </>
  );
}
function Resume({
  prompt: p,
  t,
  disabled,
  act,
}: {
  prompt: Prompt | null;
  t: T;
  disabled: boolean;
  act: (method: string, ...args: unknown[]) => Promise<boolean>;
}) {
  const [keep, setKeep] = useState(() => p?.chats.map(() => true) ?? []),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (!p)
    return (
      <p className="notice">
        {t(
          "No conversations are waiting for an answer.",
          "没有等待确认的对话。",
        )}
      </p>
    );
  const seconds = Math.max(0, Math.ceil((Date.parse(p.deadline) - now) / 1000));
  async function answer(values: boolean[]) {
    if (await act("AnswerResume", p!.id, values))
      await act("CloseWindow", "resume");
  }
  return (
    <>
      <p className="intro">
        {t(
          `These chats were working when Claude closed. Continue them with ${p.account}.`,
          `Claude 关闭时这些对话正在进行。使用 ${p.account} 继续。`,
        )}
      </p>
      <section className="chat-list">
        {p.chats.map((c, i) => (
          <label className="chat" key={i}>
            <input
              type="checkbox"
              checked={keep[i]}
              disabled={disabled}
              onChange={async (e) => {
                const checked = e.target.checked;
                if (p.paused || (await act("PauseResume", p.id))) {
                  setKeep((values) =>
                    values.map((v, j) => (j === i ? checked : v)),
                  );
                }
              }}
            />
            <span>
              <strong>{c.title}</strong>
              <small>{c.folder}</small>
            </span>
          </label>
        ))}
      </section>
      <p className="fine-print" role="status">
        {p.paused
          ? t("Waiting for you", "等你选择")
          : t(
              `All chats continue automatically in ${seconds}s if you do not answer.`,
              `若未作选择，所有对话将在 ${seconds} 秒后自动继续。`,
            )}
      </p>
      <div className="actions">
        <button
          className="secondary"
          disabled={disabled || (!p.paused && seconds === 0)}
          onClick={() => answer(p.chats.map(() => false))}
        >
          {t("Don’t continue", "不继续")}
        </button>
        <button
          className="primary"
          disabled={disabled || (!p.paused && seconds === 0)}
          onClick={() => answer(keep)}
        >
          {t("Continue selected", "继续选中的对话")}
        </button>
      </div>
    </>
  );
}
