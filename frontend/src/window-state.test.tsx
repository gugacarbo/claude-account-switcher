import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
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

it("discards a cancelled draft on every threshold opening, not on unrelated updates", async () => {
  let notify = () => {};
  let state = { ...initialState, thresholdOpening: 1 };
  const bridge: Bridge = {
    state: async () => ({ ...state }),
    call: async () => {},
    subscribe: (callback) => {
      notify = callback;
      return () => {};
    },
  };
  render(<App bridge={bridge} view="threshold" />);
  fireEvent.change(await screen.findByRole("spinbutton"), {
    target: { value: "85" },
  });
  await act(async () => notify());
  expect(screen.getByRole("spinbutton")).toHaveValue(85);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await act(async () => {});
  state = { ...state, thresholdOpening: 2 };
  await act(async () => notify());
  expect(screen.getByRole("spinbutton")).toHaveValue(96);
  // Native close only hides the webview too; reopening must reset that draft.
  fireEvent.change(screen.getByRole("spinbutton"), {
    target: { value: "90" },
  });
  state = { ...state, thresholdOpening: 3 };
  await act(async () => notify());
  expect(screen.getByRole("spinbutton")).toHaveValue(96);
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

it("updates a reused threshold window when the backend setting changes", async () => {
  let notify = () => {};
  let state = { ...initialState };
  const bridge: Bridge = {
    state: async () => state,
    call: vi.fn(),
    subscribe: (callback) => {
      notify = callback;
      return () => {};
    },
  };
  render(<App bridge={bridge} view="threshold" />);
  expect(await screen.findByRole("spinbutton")).toHaveValue(96);
  state = { ...state, threshold: 85 };
  notify();
  await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(85));
});
