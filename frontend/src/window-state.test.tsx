import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, it, expect, vi } from "vitest";
import { App } from "./App";
import type { Bridge, UIState } from "./bridge";
afterEach(cleanup);
it("updates a reused threshold window when the backend setting changes", async () => {
  let notify = () => {};
  let state = {
    accounts: [],
    threshold: 96,
    lang: "en",
    version: "0.3.7",
    resume: null,
  } as unknown as UIState;
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
