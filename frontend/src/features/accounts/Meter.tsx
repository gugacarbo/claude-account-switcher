import type { T } from "../../shared/i18n";
export function Meter({
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
            new Date(reset).toLocaleString(
              document.documentElement.lang === "zh-CN" ? "zh-CN" : "en",
              {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              },
            )
          : t("Reset time unavailable", "重置时间未知")}
      </span>
    </div>
  );
}
