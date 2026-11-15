import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

afterEach(cleanup);

describe("Checkbox (shadcn/ui)", () => {
  it("renders an accessible checkbox and reports toggles", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Auto-switch when nearly full"
        defaultChecked
        onCheckedChange={onCheckedChange}
      />,
    );
    const box = screen.getByRole("checkbox", {
      name: "Auto-switch when nearly full",
    });
    expect(box).toBeChecked();
    fireEvent.click(box);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("reflects controlled state and data-checked styling hook", () => {
    render(<Checkbox aria-label="Start at login" checked={true} />);
    const box = screen.getByRole("checkbox", { name: "Start at login" });
    expect(box).toHaveAttribute("data-state", "checked");
  });

  it("does not toggle when disabled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox
        aria-label="Import chats from SSH hosts"
        disabled
        onCheckedChange={onCheckedChange}
      />,
    );
    const box = screen.getByRole("checkbox", {
      name: "Import chats from SSH hosts",
    });
    expect(box).toBeDisabled();
    fireEvent.click(box);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
