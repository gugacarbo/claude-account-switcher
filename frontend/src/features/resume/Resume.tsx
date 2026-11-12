import { useEffect, useState } from "react";
import type { Prompt } from "../../bridge";
import type { T } from "../../shared/i18n";
export function Resume({
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
          <label className="chat" key={`${c.folder}:${c.title}`}>
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
          type="button"
          className="secondary"
          disabled={disabled || (!p.paused && seconds === 0)}
          onClick={() => answer(p.chats.map(() => false))}
        >
          {t("Don’t continue", "不继续")}
        </button>
        <button
          type="button"
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
