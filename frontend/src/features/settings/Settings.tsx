import type { UIState } from "../../bridge";
import type { T } from "../../shared/i18n";
export function Settings({
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
        type="button"
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
