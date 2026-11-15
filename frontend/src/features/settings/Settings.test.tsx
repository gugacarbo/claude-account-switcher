import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeUiState } from "../../testing/fake-bridge";
import { Settings } from "./Settings";

afterEach(cleanup);

const t = (en: string) => en;

describe("Settings", () => {
  it("renders every option as a Radix checkbox inside a Label row", () => {
    const act = vi.fn(async () => true);
    render(
      <Settings
        state={makeUiState({ autoSwitch: true, spendWeekly: false })}
        t={t}
        disabled={false}
        act={act}
      />,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    for (const box of boxes) {
      expect(box).toHaveAttribute("data-slot", "checkbox");
      expect(box.closest('[data-slot="label"]')).toHaveClass("setting");
    }
    expect(
      screen.getByRole("checkbox", { name: "Auto-switch when nearly full" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Use expiring weekly allowance" }),
    ).not.toBeChecked();
    expect(
      screen.getByText("Move to the account with the most room left."),
    ).toBeVisible();
    expect(act).not.toHaveBeenCalled();
  });

  it("persists toggles through SetOption with the new boolean value", () => {
    const act = vi.fn(async () => true);
    render(
      <Settings
        state={makeUiState({ autoSwitch: true, autostart: false })}
        t={t}
        disabled={false}
        act={act}
      />,
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Auto-switch when nearly full" }),
    );
    expect(act).toHaveBeenCalledWith("SetOption", "autoSwitch", false);
    fireEvent.click(screen.getByRole("checkbox", { name: "Start at login" }));
    expect(act).toHaveBeenCalledWith("SetOption", "autostart", true);
  });

  it("disables every option while busy", () => {
    const act = vi.fn(async () => true);
    render(<Settings state={makeUiState()} t={t} disabled={true} act={act} />);
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box).toBeDisabled();
      fireEvent.click(box);
    }
    expect(act).not.toHaveBeenCalled();
  });

  it("shows the current threshold in a shadcn link button", () => {
    const act = vi.fn(async () => true);
    render(
      <Settings
        state={makeUiState({ threshold: 94 })}
        t={t}
        disabled={false}
        act={act}
      />,
    );
    const link = screen.getByRole("button", { name: /Auto-switch threshold/ });
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveClass("threshold-link");
    expect(link).toHaveTextContent("94% →");
  });

  it("opens the threshold in place when the panel provides a callback", () => {
    const act = vi.fn(async () => true);
    const onOpenThreshold = vi.fn();
    render(
      <Settings
        state={makeUiState()}
        t={t}
        disabled={false}
        act={act}
        onOpenThreshold={onOpenThreshold}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Auto-switch threshold/ }),
    );
    expect(onOpenThreshold).toHaveBeenCalledOnce();
    expect(act).not.toHaveBeenCalled();
  });

  it("asks the desktop for a window when standalone", () => {
    const act = vi.fn(async () => true);
    render(<Settings state={makeUiState()} t={t} disabled={false} act={act} />);
    fireEvent.click(
      screen.getByRole("button", { name: /Auto-switch threshold/ }),
    );
    expect(act).toHaveBeenCalledWith("OpenWindow", "threshold");
  });

  it("speaks Chinese when the state language is zh-CN", () => {
    const zh = (_en: string, cn: string) => cn;
    render(
      <Settings
        state={makeUiState({ lang: "zh-CN" })}
        t={zh}
        disabled={false}
        act={vi.fn(async () => true)}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "额度快用完时自动切换" }),
    ).toBeChecked();
    expect(screen.getByText("减少打断，专注工作。")).toBeVisible();
    expect(screen.getByText("自动切换阈值")).toBeVisible();
  });
});
