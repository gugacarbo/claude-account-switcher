import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";
import type { Bridge, UIState } from "./bridge";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const initialState: UIState = {
  accounts: [],
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
  lang: "en",
  version: "test",
  resume: null,
};

async function openThreshold(state = initialState): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
  fireEvent.click(
    screen.getByRole("button", { name: /Auto-switch threshold/ }),
  );
  await screen.findByRole("spinbutton");
  expect(state.threshold).toBeGreaterThan(0);
}

it("preserves a threshold draft across unrelated updates and discards it on cancel", async () => {
  let notify = () => {};
  let state = { ...initialState };
  const calls: unknown[][] = [];
  const bridge: Bridge = {
    state: async () => ({ ...state }),
    call: async (method, ...args) => {
      calls.push([method, ...args]);
    },
    subscribe: (callback) => {
      notify = callback;
      return () => {};
    },
  };
  render(<App bridge={bridge} view="panel" />);
  await openThreshold(state);
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "85" },
  });
  state = { ...state, status: "unrelated update" };
  await act(async () => notify());
  expect(screen.getByRole("spinbutton")).toHaveValue(85);
  // Unified navigation must not ask the desktop for windows.
  expect(calls).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(await screen.findByText("Make it work for you")).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: /Auto-switch threshold/ }),
  );
  expect(await screen.findByRole("spinbutton")).toHaveValue(96);
});

it("returns to settings only after SetThreshold succeeds without closing windows", async () => {
  let notify = () => {};
  let state = { ...initialState };
  const calls: unknown[][] = [];
  let resolveSave: (() => void) | null = null;
  const bridge: Bridge = {
    state: async () => ({ ...state }),
    call: (method, ...args) => {
      calls.push([method, ...args]);
      if (method === "SetThreshold") {
        return new Promise((resolve) => {
          resolveSave = () => resolve(undefined);
        });
      }
      return Promise.resolve(undefined);
    },
    subscribe: (callback) => {
      notify = callback;
      return () => {};
    },
  };
  render(<App bridge={bridge} view="panel" />);
  await openThreshold(state);
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "85" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set threshold" }));
  expect(screen.getByText("Choose your limit")).toBeVisible();
  expect(screen.getByRole("button", { name: "Set threshold" })).toBeDisabled();
  await act(async () => resolveSave?.());
  expect(await screen.findByText("Make it work for you")).toBeVisible();
  expect(calls).toContainEqual(["SetThreshold", 85]);
  expect(calls.every(([method]) => method !== "CloseWindow")).toBe(true);
  // Reopening shows the value the backend accepted.
  state = { ...state, threshold: 85 };
  await act(async () => notify());
  fireEvent.click(
    screen.getByRole("button", { name: /Auto-switch threshold/ }),
  );
  expect(await screen.findByRole("spinbutton")).toHaveValue(85);
});

it("keeps the threshold screen and the draft when saving fails", async () => {
  const bridge: Bridge = {
    state: async () => ({ ...initialState }),
    call: vi.fn().mockRejectedValue(new Error("Save failed")),
    subscribe: () => () => {},
  };
  render(<App bridge={bridge} view="panel" />);
  await openThreshold(initialState);
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "85" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Set threshold" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Save failed");
  expect(screen.getByText("Choose your limit")).toBeVisible();
  expect(screen.getByRole("spinbutton")).toHaveValue(85);
});

it("closes the panel window from any unified screen without opening windows", async () => {
  const call = vi.fn().mockResolvedValue(undefined);
  const bridge: Bridge = {
    state: async () => ({ ...initialState }),
    call,
    subscribe: () => () => {},
  };
  render(<App bridge={bridge} view="panel" />);
  fireEvent.click(await screen.findByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(call).toHaveBeenCalledWith("CloseWindow", "panel"),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() =>
    expect(call).toHaveBeenNthCalledWith(2, "CloseWindow", "panel"),
  );
  expect(call).not.toHaveBeenCalledWith("OpenWindow", expect.anything());
});

it("updates a clean threshold draft when the backend setting changes", async () => {
  let notify = () => {};
  let state = { ...initialState };
  const bridge: Bridge = {
    state: async () => ({ ...state }),
    call: async () => {},
    subscribe: (callback) => {
      notify = callback;
      return () => {};
    },
  };
  render(<App bridge={bridge} view="panel" />);
  await openThreshold(state);
  expect(screen.getByRole("spinbutton")).toHaveValue(96);
  state = { ...state, threshold: 85 };
  await act(async () => notify());
  await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(85));
});

it("pauses resume on checkbox interaction and allows confirmation past the original deadline", async () => {
  vi.useFakeTimers();
  let state: UIState = {
    ...initialState,
    resume: {
      id: "p",
      account: "Ada",
      chats: [{ title: "Work", folder: "app" }],
      deadline: new Date(Date.now() + 30000).toISOString(),
      paused: false,
    },
  };
  const calls: unknown[][] = [];
  const bridge: Bridge = {
    state: async () => state,
    call: async (method, ...args) => {
      calls.push([method, ...args]);
      if (method === "PauseResume") {
        state = { ...state, resume: { ...state.resume!, paused: true } };
      }
    },
    subscribe: () => () => {},
  };
  render(<App bridge={bridge} view="resume" />);
  await act(async () => {});
  fireEvent.click(screen.getByRole("checkbox", { name: /Work/ }));
  await act(async () => {});
  expect(calls).toContainEqual(["PauseResume", "p"]);
  await act(async () => {
    vi.advanceTimersByTime(31000);
  });
  expect(screen.getByText("Waiting for you")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Continue selected" }),
  ).not.toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Continue selected" }));
  await act(async () => {});
  expect(calls).toContainEqual(["AnswerResume", "p", [false]]);
});
