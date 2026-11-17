import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { UIState } from "../../bridge";
import { TrayMenu } from "./TrayMenu";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

const state: UIState = {
  accounts: [
    {
      id: "uuid-ada",
      name: "Ada",
      email: "ada@example.test",
      plan: "Pro",
      active: true,
      detail: "",
      usage: {
        session: 42,
        weekly: 60,
        sessionReset: "",
        weeklyReset: "",
        checkedAt: "",
      },
    },
    {
      id: "uuid-lin",
      name: "Lin",
      email: "lin@example.test",
      plan: "Max",
      active: false,
      detail: "",
      usage: null,
    },
    {
      id: "uuid-sam",
      name: "Sam",
      email: "sam@example.test",
      plan: "Team",
      active: false,
      detail: "",
      usage: {
        session: 5,
        weekly: 8,
        sessionReset: "",
        weeklyReset: "",
        checkedAt: "",
      },
    },
  ],
  autoSwitch: false,
  spendWeekly: false,
  sshImport: false,
  autostart: false,
  threshold: 96,
  thresholdOpening: 0,
  busy: false,
  status: "",
  note: "",
  update: "",
  version: "0.3.7",
  lang: "en",
  resume: null,
};

function setup(
  overrides: Partial<Parameters<typeof TrayMenu>[0]> = {},
  value: UIState | null = state,
) {
  const props = {
    state: value,
    lang: "en",
    pending: false,
    error: "",
    onSwitch: vi.fn(),
    onOpenPanel: vi.fn(),
    onQuit: vi.fn(),
    onEscape: vi.fn(),
    ...overrides,
  };
  render(<TrayMenu {...props} />);
  return props;
}

describe("TrayMenu account switcher", () => {
  it("lists name, email and plan for every account and marks the active one", () => {
    setup();
    const items = screen.getAllByRole("menuitemradio");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    expect(items[1]).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Ada")).toBeVisible();
    expect(screen.getByText("ada@example.test")).toBeVisible();
    expect(screen.getByText("Pro")).toBeVisible();
    expect(screen.getByText("Max")).toBeVisible();
    expect(screen.getByText("Lin")).toBeVisible();
  });

  it("shows session/weekly usage only when present", () => {
    setup();
    expect(screen.getByText(/5h 42%/)).toBeVisible();
    expect(screen.getByText(/week 60%/)).toBeVisible();
    const linItem = screen.getAllByRole("menuitemradio")[1];
    expect(linItem).toHaveTextContent("Lin");
    expect(linItem.textContent).not.toMatch(/5h|week/);
  });

  it("provides hover meters with percentages and reset times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T10:00:00Z"));
    setup(
      {},
      {
        ...state,
        accounts: [
          {
            ...state.accounts[0],
            usage: {
              ...state.accounts[0].usage!,
              sessionReset: "2030-01-01T13:53:00Z",
              weeklyReset: "2030-01-03T15:00:00Z",
            },
          },
        ],
      },
    );
    const meters = screen.getAllByRole("progressbar", { hidden: true });
    expect(meters).toHaveLength(2);
    expect(meters[0]).toHaveAttribute("aria-valuenow", "42");
    expect(meters[1]).toHaveAttribute("aria-valuenow", "60");
    expect(meters[0].closest(".tray-account-meter")).toHaveTextContent(
      "42%3h 53min",
    );
    expect(meters[1].closest(".tray-account-meter")).toHaveTextContent(
      "60%2d 5h",
    );
  });

  it("shows the reset clock, with date only when it is not today", () => {
    vi.stubEnv("TZ", "UTC");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T10:00:00Z"));
    setup(
      {},
      {
        ...state,
        accounts: [
          {
            ...state.accounts[0],
            usage: {
              ...state.accounts[0].usage!,
              sessionReset: "2030-01-01T12:00:00Z",
              weeklyReset: "2030-01-05T12:00:00Z",
            },
          },
        ],
      },
    );
    expect(screen.getByText("5h 42% · reset 12:00")).toBeVisible();
    expect(screen.getByText("week 60% · reset 05/01 12:00")).toBeVisible();
  });

  it("sorts the active account first, keeping the order of the rest", () => {
    setup(
      {},
      {
        ...state,
        accounts: [
          state.accounts[1], // Lin
          state.accounts[2], // Sam
          state.accounts[0], // Ada (active)
        ],
      },
    );
    const items = screen.getAllByRole("menuitemradio");
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    expect(items[0]).toHaveTextContent("Ada");
    expect(items[1]).toHaveTextContent("Lin");
    expect(items[2]).toHaveTextContent("Sam");
  });

  it("shows an expired reset as now and omits missing reset times", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T10:00:00Z"));
    setup(
      {},
      {
        ...state,
        accounts: [
          {
            ...state.accounts[0],
            usage: {
              ...state.accounts[0].usage!,
              sessionReset: "2030-01-01T09:00:00Z",
              weeklyReset: "",
            },
          },
        ],
      },
    );
    expect(screen.getByText("5h 42% · reset now")).toBeVisible();
    expect(screen.getByText("week 60%")).toBeVisible();
  });

  it("clicking an inactive account switches by UUID and keeps the menu open", () => {
    const { onSwitch } = setup();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Lin/ }));
    expect(onSwitch).toHaveBeenCalledWith("uuid-lin");
    // Menu stays open for feedback; the account list is still rendered.
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });

  it("blocks the active account and every account while busy or pending", () => {
    const { onSwitch } = setup();
    expect(
      (screen.getByRole("menuitemradio", { name: /Ada/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    cleanup();
    const pending = setup({ pending: true });
    for (const item of screen.getAllByRole("menuitemradio")) {
      expect(item).toBeDisabled();
      fireEvent.click(item);
    }
    expect(pending.onSwitch).not.toHaveBeenCalled();
    expect(onSwitch).not.toHaveBeenCalled();
    cleanup();
    const busy = setup({}, { ...state, busy: true });
    for (const item of screen.getAllByRole("menuitemradio")) {
      expect(item).toBeDisabled();
      fireEvent.click(item);
    }
    expect(busy.onSwitch).not.toHaveBeenCalled();
  });

  it("shows backend state errors visibly", () => {
    setup({ error: "Switch failed: account locked" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Switch failed: account locked",
    );
  });

  it("shows a loading status before the first signed state arrives", () => {
    setup({}, null);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("shows an empty hint when there are no accounts", () => {
    setup({}, { ...state, accounts: [] });
    expect(screen.getByText("No accounts yet")).toBeVisible();
    expect(screen.queryByRole("menuitemradio")).toBeNull();
  });

  it("Open panel and Quit keep working", () => {
    const { onOpenPanel, onQuit } = setup();
    fireEvent.click(screen.getByRole("menuitem", { name: "Open panel" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Quit" }));
    expect(onOpenPanel).toHaveBeenCalledTimes(1);
    expect(onQuit).toHaveBeenCalledTimes(1);
  });

  it("opens without focusing an inactive account", () => {
    setup();
    const items = screen.getAllByRole("menuitemradio");
    expect(items[1]).not.toHaveFocus();
    expect(items[2]).not.toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
  });

  it("navigates with arrows/Home/End, skipping disabled entries, and Escape asks to close", () => {
    setup();
    const items = screen.getAllByRole("menuitemradio");
    // Ada (index 0) is the active account and stays disabled: navigation wraps
    // around it.
    items[1].focus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowUp" });
    expect(items[2]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Home" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "End" });
    expect(items[2]).toHaveFocus();
  });

  it.each(["pending", "busy", "empty", "loading"])(
    "Escape closes the dropdown while %s",
    (mode) => {
      const value =
        mode === "loading"
          ? null
          : {
              ...state,
              busy: mode === "busy",
              accounts: mode === "empty" ? [] : state.accounts,
            };
      const { onEscape } = setup({ pending: mode === "pending" }, value);
      fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
      expect(onEscape).toHaveBeenCalledTimes(1);
    },
  );

  it("Escape asks the host to close the dropdown", () => {
    const { onEscape } = setup();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});
