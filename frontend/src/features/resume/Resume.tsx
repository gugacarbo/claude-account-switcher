import { useEffect, useState } from "react";
import type { Prompt } from "../../bridge";
import { Alert } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Label } from "../../components/ui/label";
import type { T } from "../../shared/i18n";
export function Resume({
  prompt: p,
  t,
  disabled,
  act,
  onCancel,
  cancelLabel,
}: {
  prompt: Prompt | null;
  t: T;
  disabled: boolean;
  act: (method: string, ...args: unknown[]) => Promise<boolean>;
  onCancel?: () => void;
  cancelLabel?: string;
}) {
  const [keep, setKeep] = useState(() => p?.chats.map(() => true) ?? []),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  if (!p)
    return (
      <Alert className="notice" role="none">
        {t(
          "No conversations are waiting for an answer.",
          "没有等待确认的对话。",
        )}
      </Alert>
    );
  const seconds = Math.max(0, Math.ceil((Date.parse(p.deadline) - now) / 1000));
  async function answer(values: boolean[]) {
    if (await act("AnswerResume", p!.id, values))
      await act("CloseWindow", "resume");
  }
  async function deselectAll() {
    if (p!.paused || (await act("PauseResume", p!.id))) {
      setKeep(p!.chats.map(() => false));
    }
  }
  return (
    <>
      <p className="intro">
        {t(
          `These chats were working when Claude closed. Continue them with ${p.account}.`,
          `Claude 关闭时这些对话正在进行。使用 ${p.account} 继续。`,
        )}
      </p>
      <div className="chat-list-actions">
        <p className="fine-print" role="status">
          {p.paused
            ? t("Waiting for you", "等你选择")
            : t(
                `All chats continue automatically in ${seconds}s if you do not answer.`,
                `若未作选择，所有对话将在 ${seconds} 秒后自动继续。`,
              )}
        </p>
        <Button
          type="button"
          variant="link"
          className="text-link"
          disabled={disabled || keep.every((selected) => !selected)}
          onClick={deselectAll}
        >
          {t("Deselect all", "取消全选")}
        </Button>
      </div>
      <section className="chat-list">
        {p.chats.map((c, i) => (
          <Label className="chat" key={`${c.folder}:${c.title}`}>
            <Checkbox
              checked={keep[i]}
              disabled={disabled}
              onCheckedChange={async (checked) => {
                const isChecked = checked === true;
                if (p.paused || (await act("PauseResume", p.id))) {
                  setKeep((values) =>
                    values.map((v, j) => (j === i ? isChecked : v)),
                  );
                }
              }}
            />
            <span>
              <strong>{c.title}</strong>
              <small>{c.folder}</small>
            </span>
          </Label>
        ))}
      </section>
      <div className="actions">
        <Button
          type="button"
          variant="ghost"
          className="secondary"
          disabled={disabled || (!p.paused && seconds === 0)}
          onClick={() =>
            onCancel ? onCancel() : answer(p.chats.map(() => false))
          }
        >
          {cancelLabel ?? t("Don’t continue", "不继续")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="primary"
          disabled={disabled || (!p.paused && seconds === 0)}
          onClick={() => answer(keep)}
        >
          {t("Continue selected", "继续选中的对话")}
        </Button>
      </div>
    </>
  );
}
