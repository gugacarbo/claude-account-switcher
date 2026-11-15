import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  fakeBridge,
  makeAccount,
  makeUiState,
} from "../../testing/fake-bridge";
import { TrayMenu } from "./TrayMenu";

const accounts = [
  makeAccount(),
  makeAccount({
    id: "demo-2",
    name: "Lin Chen",
    email: "lin@example.com",
    active: false,
    usage: {
      session: 7.6,
      weekly: 31.2,
      sessionReset: "2030-01-01T12:00:00Z",
      weeklyReset: "2030-01-05T12:00:00Z",
      checkedAt: "2030-01-01T10:00:00Z",
    },
  }),
  makeAccount({
    id: "demo-3",
    name: "",
    email: "sam@example.com",
    active: false,
    usage: null,
  }),
];

afterEach(cleanup);

describe("TrayMenu", () => {
  it("summarises every account with its usage and marks the active one", () => {
    render(
      <TrayMenu bridge={fakeBridge()} state={makeUiState({ accounts })} />,
    );
    const rows = screen.getAllByRole("menuitemradio");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAttribute("aria-checked", "true");
    expect(rows[0]).toHaveTextContent("Alex Morgan");
    expect(rows[0]).toHaveTextContent("5h 42% · Week 68%");
    expect(rows[1]).toHaveAttribute("aria-checked", "false");
    expect(rows[1]).toHaveTextContent("5h 8% · Week 31%");
    expect(rows[2]).toHaveTextContent("sam@example.com");
    // Composição shadcn: linhas são Buttons, iniciais vêm do Avatar Radix.
    for (const row of rows) {
      expect(row).toHaveAttribute("data-slot", "button");
      const avatar = row.querySelector('[data-slot="avatar"]');
      expect(avatar).toHaveClass("tray-menu-avatar");
      expect(
        avatar?.querySelector('[data-slot="avatar-fallback"]'),
      ).not.toBeNull();
    }
    expect(
      rows[0].querySelector('[data-slot="avatar-fallback"]'),
    ).toHaveTextContent("A");
    expect(
      rows[2].querySelector('[data-slot="avatar-fallback"]'),
    ).toHaveTextContent("S");
  });

  it("tells accounts with the same name apart by email", () => {
    render(
      <TrayMenu
        bridge={fakeBridge()}
        state={makeUiState({
          accounts: [
            makeAccount({ id: "a", name: "Gus", email: "work@example.com" }),
            makeAccount({
              id: "b",
              name: "Gus",
              email: "home@example.com",
              active: false,
            }),
          ],
        })}
      />,
    );
    const rows = screen.getAllByRole("menuitemradio");
    expect(rows[0]).toHaveTextContent("work@example.com");
    expect(rows[1]).toHaveTextContent("home@example.com");
  });

  it("switches to another account and closes itself", async () => {
    const bridge = fakeBridge();
    render(<TrayMenu bridge={bridge} state={makeUiState({ accounts })} />);
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Lin Chen/ }));
    await waitFor(() =>
      expect(bridge.calls).toEqual([
        { method: "SwitchAccount", args: ["demo-2"] },
        { method: "CloseWindow", args: ["menu"] },
      ]),
    );
  });

  it("only closes when the active account is picked", async () => {
    const bridge = fakeBridge();
    render(<TrayMenu bridge={bridge} state={makeUiState({ accounts })} />);
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Alex Morgan/ }));
    await waitFor(() =>
      expect(bridge.calls).toEqual([{ method: "CloseWindow", args: ["menu"] }]),
    );
  });

  it("blocks switching while an operation runs", () => {
    render(
      <TrayMenu
        bridge={fakeBridge()}
        state={makeUiState({ accounts, busy: true })}
      />,
    );
    expect(screen.getByText("Switching…")).toBeVisible();
    expect(
      screen.getByRole("menuitemradio", { name: /Lin Chen/ }),
    ).toBeDisabled();
  });

  it("opens the panel and quits through shadcn menu items", async () => {
    const bridge = fakeBridge();
    render(<TrayMenu bridge={bridge} state={makeUiState({ accounts })} />);
    const separator = document.querySelector('[data-slot="separator"]');
    expect(separator).toHaveClass("tray-menu-separator");
    const open = screen.getByRole("menuitem", { name: "Open" });
    expect(open).toHaveAttribute("data-slot", "button");
    expect(open).toHaveClass("tray-menu-item");
    fireEvent.click(open);
    await waitFor(() =>
      expect(bridge.calls).toContainEqual({
        method: "OpenWindow",
        args: ["panel"],
      }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Quit" }));
    await waitFor(() =>
      expect(bridge.calls).toContainEqual({ method: "Quit", args: [] }),
    );
  });

  it("speaks Chinese and handles an empty list", () => {
    render(
      <TrayMenu
        bridge={fakeBridge()}
        state={makeUiState({ accounts: [], lang: "zh-CN" })}
      />,
    );
    expect(screen.getByText("还没有账号")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "打开" })).toBeVisible();
  });
});
