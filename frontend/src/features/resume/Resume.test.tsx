import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makePrompt } from "../../testing/fake-bridge";
import { Resume } from "./Resume";

afterEach(cleanup);

const t = (en: string) => en;

describe("Resume", () => {
  it("shows a quiet shadcn notice when nothing is waiting", () => {
    const actFn = vi.fn(async () => true);
    render(<Resume prompt={null} t={t} disabled={false} act={actFn} />);
    const notice = screen.getByText(
      "No conversations are waiting for an answer.",
    );
    expect(notice).toHaveAttribute("data-slot", "alert");
    expect(notice).toHaveClass("notice");
    // role=none: informational, not an interruptive alert.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(actFn).not.toHaveBeenCalled();
  });

  it("lists every chat preselected as a Radix checkbox in a Label row", () => {
    const actFn = vi.fn(async () => true);
    render(<Resume prompt={makePrompt()} t={t} disabled={false} act={actFn} />);
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2);
    for (const box of boxes) {
      expect(box).toBeChecked();
      expect(box).toHaveAttribute("data-slot", "checkbox");
      expect(box.closest('[data-slot="label"]')).toHaveClass("chat");
    }
    expect(screen.getByText("Workspace migration")).toBeVisible();
    expect(screen.getAllByText("/projects/demo")).toHaveLength(2);
    expect(screen.getByText(/Continue them with Alex Morgan/)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for you");
    expect(actFn).not.toHaveBeenCalled();
  });

  it("deselects every chat with one action", async () => {
    const actFn = vi.fn(async () => true);
    render(<Resume prompt={makePrompt()} t={t} disabled={false} act={actFn} />);
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    await vi.waitFor(() => {
      for (const box of screen.getAllByRole("checkbox")) {
        expect(box).not.toBeChecked();
      }
    });
    expect(actFn).not.toHaveBeenCalledWith("PauseResume", "prompt-1");
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeDisabled();
  });

  it("pauses the countdown before deselecting every chat", async () => {
    const actFn = vi.fn(async () => true);
    const prompt = makePrompt({ paused: false });
    render(<Resume prompt={prompt} t={t} disabled={false} act={actFn} />);
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    await vi.waitFor(() => {
      expect(actFn).toHaveBeenCalledWith("PauseResume", "prompt-1");
      for (const box of screen.getAllByRole("checkbox")) {
        expect(box).not.toBeChecked();
      }
    });
  });

  it("continues only the selected chats and closes the window", async () => {
    const actFn = vi.fn(async () => true);
    render(<Resume prompt={makePrompt()} t={t} disabled={false} act={actFn} />);
    fireEvent.click(screen.getAllByRole("checkbox")[1]);
    const continueButton = screen.getByRole("button", {
      name: "Continue selected",
    });
    expect(continueButton).toHaveAttribute("data-slot", "button");
    expect(continueButton).toHaveClass("primary");
    fireEvent.click(continueButton);
    await vi.waitFor(() =>
      expect(actFn.mock.calls).toEqual([
        ["AnswerResume", "prompt-1", [true, false]],
        ["CloseWindow", "resume"],
      ]),
    );
  });

  it("offers a way out without continuing any chat", async () => {
    const actFn = vi.fn(async () => true);
    render(<Resume prompt={makePrompt()} t={t} disabled={false} act={actFn} />);
    const skip = screen.getByRole("button", { name: "Don’t continue" });
    expect(skip).toHaveClass("secondary");
    fireEvent.click(skip);
    await vi.waitFor(() =>
      expect(actFn.mock.calls).toEqual([
        ["AnswerResume", "prompt-1", [false, false]],
        ["CloseWindow", "resume"],
      ]),
    );
  });

  it("keeps the window open when the answer fails", async () => {
    const actFn = vi.fn(async () => false);
    render(<Resume prompt={makePrompt()} t={t} disabled={false} act={actFn} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue selected" }));
    await vi.waitFor(() =>
      expect(actFn).toHaveBeenCalledWith("AnswerResume", "prompt-1", [
        true,
        true,
      ]),
    );
    expect(actFn).not.toHaveBeenCalledWith("CloseWindow", "resume");
  });

  it("pauses the countdown on the first selection change", async () => {
    vi.useFakeTimers();
    try {
      const actFn = vi.fn(async () => true);
      const prompt = makePrompt({
        paused: false,
        deadline: new Date(Date.now() + 30000).toISOString(),
      });
      render(<Resume prompt={prompt} t={t} disabled={false} act={actFn} />);
      expect(screen.getByRole("status")).toHaveTextContent(
        "All chats continue automatically in",
      );
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      await act(async () => {});
      expect(actFn).toHaveBeenCalledWith("PauseResume", "prompt-1");
      expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();
      // Already paused on the prompt side: no second pause round-trip.
      const paused = { ...prompt, paused: true };
      cleanup();
      render(<Resume prompt={paused} t={t} disabled={false} act={actFn} />);
      actFn.mockClear();
      fireEvent.click(screen.getAllByRole("checkbox")[1]);
      await act(async () => {});
      expect(actFn).not.toHaveBeenCalledWith("PauseResume", "prompt-1");
      expect(screen.getAllByRole("checkbox")[1]).not.toBeChecked();
    } finally {
      vi.useRealTimers();
    }
  });

  it("locks both answers after the deadline while unpaused", () => {
    vi.useFakeTimers();
    try {
      const actFn = vi.fn(async () => true);
      render(
        <Resume
          prompt={makePrompt({
            paused: false,
            deadline: new Date(Date.now() - 1000).toISOString(),
          })}
          t={t}
          disabled={false}
          act={actFn}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Continue selected" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Don’t continue" }),
      ).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps waiting past the deadline once paused", () => {
    const actFn = vi.fn(async () => true);
    render(
      <Resume
        prompt={makePrompt({
          paused: true,
          deadline: new Date(Date.now() - 1000).toISOString(),
        })}
        t={t}
        disabled={false}
        act={actFn}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for you");
    expect(
      screen.getByRole("button", { name: "Continue selected" }),
    ).toBeEnabled();
  });

  it("disables selections and answers while busy", () => {
    const actFn = vi.fn(async () => true);
    render(<Resume prompt={makePrompt()} t={t} disabled={true} act={actFn} />);
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).toBeDisabled();
      fireEvent.click(box);
    }
    expect(
      screen.getByRole("button", { name: "Continue selected" }),
    ).toBeDisabled();
    expect(actFn).not.toHaveBeenCalled();
  });
});
