import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge, badgeVariants } from "./badge";

afterEach(cleanup);

describe("Badge (shadcn/ui)", () => {
  it("renders a plan chip with the default variant", () => {
    render(<Badge>Pro</Badge>);
    const badge = screen.getByText("Pro");
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", "default");
  });

  it("supports the outline variant used for plan tags", () => {
    render(<Badge variant="outline">Max</Badge>);
    const badge = screen.getByText("Max");
    expect(badge).toHaveAttribute("data-variant", "outline");
    expect(badge.className).toContain("border-border");
  });

  it("renders as a link with asChild", () => {
    render(
      <Badge asChild variant="secondary">
        <a href="#usage">Usage</a>
      </Badge>,
    );
    expect(screen.getByRole("link", { name: "Usage" })).toHaveAttribute(
      "data-slot",
      "badge",
    );
  });

  it("exposes badgeVariants for composition elsewhere", () => {
    expect(badgeVariants({ variant: "destructive" })).toContain(
      "text-destructive",
    );
  });
});
