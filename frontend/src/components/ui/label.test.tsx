import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Label } from "./label";

afterEach(cleanup);

describe("Label (shadcn/ui)", () => {
  it("associates with its control through htmlFor", () => {
    render(
      <>
        <Label htmlFor="threshold">Auto-switch threshold</Label>
        <input id="threshold" type="number" />
      </>,
    );
    const label = screen.getByText("Auto-switch threshold");
    expect(label).toHaveAttribute("data-slot", "label");
    expect(label).toHaveAttribute("for", "threshold");
    expect(
      screen.getByRole("spinbutton", { name: "Auto-switch threshold" }),
    ).toBeInTheDocument();
  });

  it("accepts custom classes for composition", () => {
    render(<Label className="setting-label">Start at login</Label>);
    expect(screen.getByText("Start at login").className).toContain(
      "setting-label",
    );
  });
});
