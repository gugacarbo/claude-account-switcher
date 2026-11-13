import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WindowHeader } from "./WindowHeader";

afterEach(cleanup);

describe("WindowHeader", () => {
  it("renders the title and exposes the drag region on the bar", () => {
    render(
      <WindowHeader title="Accounts" t={(en) => en} onClose={() => {}}>
        <span>content</span>
      </WindowHeader>,
    );
    expect(screen.getByRole("heading", { name: "Accounts" })).toBeVisible();
    const bar = screen.getByTestId("window-drag");
    expect(bar).toBeVisible();
    const style = (bar as HTMLElement).style;
    expect(style.getPropertyValue("--wails-draggable").trim()).toBe("drag");
  });

  it("calls onClose when the close control is used", () => {
    const onClose = vi.fn();
    render(<WindowHeader title="Accounts" t={(en) => en} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows the back control only when onBack is provided", () => {
    const onBack = vi.fn();
    const { rerender } = render(
      <WindowHeader
        title="Back?"
        t={(en) => en}
        onClose={() => {}}
        onBack={onBack}
      />,
    );
    const back = screen.getByRole("button", { name: /back/i });
    fireEvent.click(back);
    expect(onBack).toHaveBeenCalledOnce();

    rerender(<WindowHeader title="Back?" t={(en) => en} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /back/i })).toBeNull();
  });

  it("keeps controls outside the drag region", () => {
    const onClose = vi.fn();
    render(
      <WindowHeader
        title="T"
        t={(en) => en}
        onClose={onClose}
        onBack={() => {}}
      />,
    );
    const drag = screen.getByTestId("window-drag");
    const close = screen.getByRole("button", { name: /close/i });
    const back = screen.getByRole("button", { name: /back/i });
    expect(drag.contains(close)).toBe(false);
    expect(drag.contains(back)).toBe(false);
    expect(drag.contains(screen.getByRole("heading"))).toBe(true);
  });
});
