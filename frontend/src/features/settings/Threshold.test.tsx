import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeUiState } from "../../testing/fake-bridge";
import { Threshold } from "./Threshold";

afterEach(cleanup);

const t = (en: string) => en;

function setup(overrides: Parameters<typeof makeUiState>[0] = {}) {
  const act = vi.fn(async () => true);
  render(
    <Threshold
      state={makeUiState(overrides)}
      t={t}
      disabled={false}
      act={act}
    />,
  );
  return act;
}

describe("Threshold", () => {
  it("renders a shadcn number input and a Radix slider for the current value", () => {
    setup({ threshold: 96 });
    const input = screen.getByRole("spinbutton", {
      name: "Threshold in percent",
    });
    expect(input).toHaveAttribute("data-slot", "input");
    expect(input).toHaveValue(96);
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "99");
    const thumb = screen.getByRole("slider", { name: "Threshold slider" });
    expect(thumb).toHaveAttribute("aria-valuenow", "96");
    expect(thumb).toHaveAttribute("aria-valuemin", "1");
    expect(thumb).toHaveAttribute("aria-valuemax", "99");
    expect(thumb.closest('[data-slot="slider"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "96%" })).toHaveClass("selected");
  });

  it("steps the slider with the keyboard and syncs the input", () => {
    setup({ threshold: 96 });
    const thumb = screen.getByRole("slider");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(
      screen.getByRole("spinbutton", { name: "Threshold in percent" }),
    ).toHaveValue(97);
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(thumb).toHaveAttribute("aria-valuenow", "1");
    fireEvent.keyDown(thumb, { key: "End" });
    expect(thumb).toHaveAttribute("aria-valuenow", "99");
    expect(
      screen.getByRole("spinbutton", { name: "Threshold in percent" }),
    ).toHaveValue(99);
  });

  it("rejects values outside 1..99 and non-integers", () => {
    setup();
    const input = screen.getByRole("spinbutton");
    const status = screen.getByRole("status");
    const save = screen.getByRole("button", { name: "Set threshold" });
    for (const bad of ["0", "100", "55.5", ""]) {
      fireEvent.change(input, { target: { value: bad } });
      expect(status).toHaveTextContent("Enter a whole number from 1 to 99.");
      expect(save).toBeDisabled();
    }
    fireEvent.change(input, { target: { value: "42" } });
    expect(save).toBeEnabled();
    expect(status).toHaveTextContent("Only accounts below 32% are eligible");
  });

  it("explains that low thresholds never trigger a switch", () => {
    setup();
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "8" },
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "No account can be 10 points below this limit",
    );
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuenow", "8");
  });

  it("applies presets to input and slider", () => {
    setup({ threshold: 96 });
    for (const preset of [90, 94, 96, 98]) {
      const button = screen.getByRole("button", { name: `${preset}%` });
      expect(button).toHaveAttribute("data-slot", "button");
      fireEvent.click(button);
      expect(button).toHaveClass("selected");
      expect(screen.getByRole("spinbutton")).toHaveValue(preset);
      expect(screen.getByRole("slider")).toHaveAttribute(
        "aria-valuenow",
        String(preset),
      );
    }
  });

  it("saves a valid threshold and closes the standalone window", async () => {
    const act = setup({ threshold: 96 });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "85" },
    });
    const save = screen.getByRole("button", { name: "Set threshold" });
    expect(save).toHaveClass("primary");
    fireEvent.click(save);
    await vi.waitFor(() =>
      expect(act.mock.calls).toEqual([
        ["SetThreshold", 85],
        ["CloseWindow", "threshold"],
      ]),
    );
  });

  it("returns to the caller instead of closing when embedded", async () => {
    const act = vi.fn(async () => true);
    const onComplete = vi.fn();
    render(
      <Threshold
        state={makeUiState()}
        t={t}
        disabled={false}
        act={act}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Set threshold" }));
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(act).toHaveBeenCalledWith("SetThreshold", 96);
    expect(act).not.toHaveBeenCalledWith("CloseWindow", "threshold");
  });

  it("keeps the draft when saving fails", async () => {
    const act = vi.fn(async () => false);
    render(
      <Threshold state={makeUiState()} t={t} disabled={false} act={act} />,
    );
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "85" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set threshold" }));
    await vi.waitFor(() =>
      expect(act).toHaveBeenCalledWith("SetThreshold", 85),
    );
    expect(act).not.toHaveBeenCalledWith("CloseWindow", "threshold");
    expect(screen.getByRole("spinbutton")).toHaveValue(85);
  });

  it("cancels back to the caller or closes the standalone window", async () => {
    const act = setup();
    const cancel = screen.getByRole("button", { name: "Cancel" });
    expect(cancel).toHaveClass("secondary");
    fireEvent.click(cancel);
    expect(act).toHaveBeenCalledWith("CloseWindow", "threshold");
    cleanup();
    const act2 = vi.fn(async () => true);
    const onCancel = vi.fn();
    render(
      <Threshold
        state={makeUiState()}
        t={t}
        disabled={false}
        act={act2}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(act2).not.toHaveBeenCalled();
  });

  it("blocks saving while busy but keeps cancel available", () => {
    const act = vi.fn(async () => true);
    render(<Threshold state={makeUiState()} t={t} disabled={true} act={act} />);
    expect(
      screen.getByRole("button", { name: "Set threshold" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(act).toHaveBeenCalledWith("CloseWindow", "threshold");
  });
});
