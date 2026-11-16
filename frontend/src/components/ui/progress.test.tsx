import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Progress } from "./progress";

afterEach(cleanup);

describe("Progress (shadcn/ui)", () => {
  it("exposes the value through the progressbar role", () => {
    render(<Progress value={42} aria-label="5-hour limit" />);
    const bar = screen.getByRole("progressbar", { name: "5-hour limit" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("moves the indicator proportionally to the value", () => {
    render(<Progress value={42} aria-label="Weekly limit" />);
    const indicator = screen
      .getByRole("progressbar")
      .querySelector('[data-slot="progress-indicator"]');
    expect(indicator).not.toBeNull();
    expect((indicator as HTMLElement).style.transform).toBe("translateX(-58%)");
  });

  it("treats a missing value as empty instead of crashing", () => {
    render(<Progress aria-label="Usage" />);
    const bar = screen.getByRole("progressbar");
    expect(bar).not.toHaveAttribute("aria-valuenow");
    const indicator = bar.querySelector(
      '[data-slot="progress-indicator"]',
    ) as HTMLElement;
    expect(indicator.style.transform).toBe("translateX(-100%)");
  });
});
