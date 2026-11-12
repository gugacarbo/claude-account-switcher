import { useState } from "react";
import type { UIState } from "../../bridge";
import type { T } from "../../shared/i18n";
export function Threshold({
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
              type="button"
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
          type="button"
          className="secondary"
          onClick={() => act("CloseWindow", "threshold")}
        >
          {t("Cancel", "取消")}
        </button>
        <button
          type="button"
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
