import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeAccount } from "../../testing/fake-bridge";
import { AccountCard } from "./AccountCard";

afterEach(cleanup);

const t = (en: string) => en;

describe("AccountCard", () => {
  it("renders identity, plan and usage meters for the active account", () => {
    const a = makeAccount({ active: true });
    render(
      <AccountCard
        account={a}
        threshold={96}
        t={t}
        disabled={false}
        onSwitch={() => {}}
      />,
    );
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("alex@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/Active account/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Switch to/ }),
    ).not.toBeInTheDocument();

    // Composição shadcn: o card preserva o <article> e os meters são progressbars.
    expect(screen.getByText("Alex Morgan").closest("article")).toHaveAttribute(
      "data-slot",
      "card",
    );
    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "42");
  });

  it("offers a shadcn switch button for an inactive account and fires onSwitch", () => {
    const onSwitch = vi.fn();
    const a = makeAccount({ active: false });
    render(
      <AccountCard
        account={a}
        threshold={96}
        t={t}
        disabled={false}
        onSwitch={onSwitch}
      />,
    );
    const button = screen.getByRole("button", {
      name: "Switch to Alex Morgan",
    });
    expect(button).toHaveAttribute("data-slot", "button");
    fireEvent.click(button);
    expect(onSwitch).toHaveBeenCalledOnce();
  });

  it("disables the switch button while busy", () => {
    const a = makeAccount({ active: false });
    render(
      <AccountCard
        account={a}
        threshold={96}
        t={t}
        disabled={true}
        onSwitch={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /Switch to/ })).toBeDisabled();
  });

  it("renders a signed-out card without meters", () => {
    const a = makeAccount({ active: false, usage: null, detail: "Signed out" });
    render(
      <AccountCard
        account={a}
        threshold={96}
        t={t}
        disabled={false}
        onSwitch={() => {}}
      />,
    );
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.getByText("Signed out")).toBeInTheDocument();
  });
});
