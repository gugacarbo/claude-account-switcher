import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { Bridge, UIState } from "./bridge";

afterEach(cleanup);
const state: UIState = {
  accounts: [
    {
      id: "a",
      name: "Ada",
      email: "ada@example.test",
      plan: "Pro",
      active: true,
      detail: "5h 42% · week 60%",
      usage: {
        session: 42,
        weekly: 60,
        sessionReset: "",
        weeklyReset: "",
        checkedAt: "",
      },
    },
    {
      id: "b",
      name: "Lin",
      email: "lin@example.test",
      plan: "Max",
      active: false,
      detail: "usage unknown",
      usage: null,
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
function bridge(value = state): Bridge {
  return {
    state: vi.fn().mockResolvedValue(value),
    call: vi.fn().mockResolvedValue(undefined),
    subscribe: () => () => {},
  };
}
describe("shared desktop UI", () => {
  it("shows accounts and invokes a real bridge command with the selected ID", async () => {
    const api = bridge();
    render(<App bridge={api} view="panel" />);
    expect(await screen.findByText("Ada")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Switch to Lin" }));
    await waitFor(() =>
      expect(api.call).toHaveBeenCalledWith("SwitchAccount", "b"),
    );
  });
  it("exposes all settings and persists checked values", async () => {
    const api = bridge();
    render(<App bridge={api} view="settings" />);
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Auto-switch when nearly full",
      }),
    );
    await waitFor(() =>
      expect(api.call).toHaveBeenCalledWith("SetOption", "autoSwitch", true),
    );
    expect(
      screen.getByRole("checkbox", { name: "Import chats from SSH hosts" }),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Start at login" }),
    ).toBeVisible();
  });
  it("validates custom thresholds before sending them", async () => {
    const api = bridge();
    render(<App bridge={api} view="threshold" />);
    const input = await screen.findByRole("spinbutton");
    fireEvent.change(input, { target: { value: "100" } });
    expect(
      screen.getByRole("button", { name: "Set threshold" }),
    ).toBeDisabled();
    fireEvent.change(input, { target: { value: "85" } });
    fireEvent.click(screen.getByRole("button", { name: "Set threshold" }));
    await waitFor(() =>
      expect(api.call).toHaveBeenCalledWith("SetThreshold", 85),
    );
  });
  it("sends selected resume answers and relies on the Go deadline", async () => {
    const api = bridge({
      ...state,
      resume: {
        id: "p",
        account: "Ada",
        chats: [{ title: "Build app", folder: "app" }],
        deadline: new Date(Date.now() + 30000).toISOString(),
        paused: false,
      },
    });
    render(<App bridge={api} view="resume" />);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Build app/ }));
    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: /Build app/ }),
      ).not.toBeChecked(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue selected" }));
    await waitFor(() =>
      expect(api.call).toHaveBeenCalledWith("AnswerResume", "p", [false]),
    );
  });
  it("shows bridge failures instead of pretending the operation succeeded", async () => {
    const api = bridge();
    vi.mocked(api.call).mockRejectedValue(new Error("Operation failed"));
    render(<App bridge={api} view="panel" />);
    fireEvent.click(await screen.findByRole("button", { name: "Add account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Operation failed",
    );
  });
});
