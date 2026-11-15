import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button, buttonVariants } from "./button";

afterEach(cleanup);

describe("Button (shadcn/ui)", () => {
  it("renders an accessible button and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Switch</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies variant and size and honors disabled", () => {
    render(
      <Button variant="secondary" size="sm" disabled>
        Working
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Working" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("data-variant", "secondary");
    expect(button).toHaveAttribute("data-size", "sm");
  });

  it("renders the child element when asChild is set", () => {
    render(
      <Button asChild>
        <a href="#panel">Open panel</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Open panel" });
    expect(link).toHaveAttribute("data-slot", "button");
    expect(link).toHaveAttribute("href", "#panel");
  });

  it("exposes buttonVariants for composition elsewhere", () => {
    expect(buttonVariants({ variant: "outline" })).toContain("border-border");
    expect(buttonVariants({ variant: "destructive" })).toContain(
      "text-destructive",
    );
  });
});
