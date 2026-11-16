import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "./input";

afterEach(cleanup);

describe("Input (shadcn/ui)", () => {
  it("renders a labeled input and propagates edits", () => {
    const onChange = vi.fn();
    render(
      <Input
        type="number"
        aria-label="Threshold in percent"
        defaultValue="94"
        onChange={onChange}
      />,
    );
    const input = screen.getByRole("spinbutton", {
      name: "Threshold in percent",
    });
    expect(input).toHaveValue(94);
    fireEvent.change(input, { target: { value: "96" } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(input).toHaveValue(96);
  });

  it("honors disabled and invalid states", () => {
    render(
      <Input aria-label="Threshold in percent" disabled aria-invalid={true} />,
    );
    const input = screen.getByRole("textbox", { name: "Threshold in percent" });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("data-slot", "input");
  });
});
