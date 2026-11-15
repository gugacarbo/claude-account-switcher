import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Separator } from "./separator";

afterEach(cleanup);

describe("Separator (shadcn/ui)", () => {
  it("is decorative by default and stays out of the a11y tree", () => {
    render(<Separator data-testid="sep" />);
    const sep = screen.getByTestId("sep");
    expect(sep).toHaveAttribute("data-slot", "separator");
    expect(sep.getAttribute("role")).toBe("none");
  });

  it("exposes a semantic separator when not decorative", () => {
    render(<Separator decorative={false} />);
    const sep = screen.getByRole("separator");
    // Radix omite aria-orientation no padrão horizontal (implícito).
    expect(sep).not.toHaveAttribute("aria-orientation");
  });

  it("supports vertical orientation", () => {
    render(<Separator decorative={false} orientation="vertical" />);
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });
});
