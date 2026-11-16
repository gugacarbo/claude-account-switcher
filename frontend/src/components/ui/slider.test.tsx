import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Slider } from "./slider";

afterEach(cleanup);

describe("Slider (shadcn/ui)", () => {
  it("renders one thumb per value with the right range metadata", () => {
    render(<Slider defaultValue={[94]} max={99} min={1} />);
    // O role=slider fica no thumb (elemento focável), não no Root.
    const thumb = screen.getByRole("slider");
    expect(thumb).toHaveAttribute("aria-valuenow", "94");
    expect(thumb).toHaveAttribute("aria-valuemin", "1");
    expect(thumb).toHaveAttribute("aria-valuemax", "99");
    expect(thumb.closest('[data-slot="slider"]')).not.toBeNull();
  });

  it("steps the value with the keyboard and reports changes", () => {
    const onValueChange = vi.fn();
    render(
      <Slider
        aria-label="Threshold slider"
        defaultValue={[94]}
        max={99}
        min={1}
        onValueChange={onValueChange}
      />,
    );
    const thumb = screen.getByRole("slider");
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenCalledWith([95]);
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(onValueChange).toHaveBeenCalledWith([1]);
    fireEvent.keyDown(thumb, { key: "End" });
    expect(onValueChange).toHaveBeenCalledWith([99]);
  });

  it("renders a thumb for each value of a range slider", () => {
    render(<Slider aria-label="Usage window" defaultValue={[20, 80]} />);
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAttribute("aria-valuenow", "20");
    expect(thumbs[1]).toHaveAttribute("aria-valuenow", "80");
  });
});
