import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Meter } from "./Meter";

afterEach(cleanup);

const t = (en: string) => en;

describe("Meter", () => {
  it("renders the label and an accessible shadcn progressbar", () => {
    render(
      <Meter
        label="5-hour limit"
        value={42.4}
        reset="2030-01-01T12:00:00Z"
        threshold={96}
        t={t}
      />,
    );
    expect(screen.getByText("5-hour limit")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "5-hour limit" });
    expect(bar).toHaveAttribute("data-slot", "progress");
    expect(bar).toHaveAttribute("aria-valuenow", "42.4");
    expect(screen.getByText("42")).toBeInTheDocument(); // texto arredondado; valor acessível preciso.
    expect(screen.getByText(/Resets/)).toBeInTheDocument();
  });

  it("flags warn and full states on the progress fill", () => {
    const { rerender } = render(
      <Meter
        label="Weekly limit"
        value={80}
        reset="2030-01-01T12:00:00Z"
        threshold={96}
        t={t}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveClass("warn");
    rerender(
      <Meter
        label="Weekly limit"
        value={97}
        reset="2030-01-01T12:00:00Z"
        threshold={96}
        t={t}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveClass("full");
  });

  it("shows a fallback when the reset time is unavailable", () => {
    render(
      <Meter
        label="Weekly limit"
        value={10}
        reset="0001-01-01T00:00:00Z"
        threshold={96}
        t={t}
      />,
    );
    expect(screen.getByText("Reset time unavailable")).toBeInTheDocument();
  });

  it("clamps the value into the 0..100 range", () => {
    render(
      <Meter
        label="Weekly limit"
        value={150}
        reset="2030-01-01T12:00:00Z"
        threshold={96}
        t={t}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
  });
});
