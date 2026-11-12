import type { Account } from "../../bridge";
import type { T } from "../../shared/i18n";
import { Meter } from "./Meter";
export function AccountCard({
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
    <article className={`account-card ${a.active ? "active" : ""}`}>
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
            type="button"
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
