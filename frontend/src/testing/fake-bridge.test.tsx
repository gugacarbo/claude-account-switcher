import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import {
  fakeBridge,
  makeAccount,
  makeManyAccounts,
  makePrompt,
  makeUiState,
} from "./fake-bridge";

afterEach(cleanup);

describe("fakeBridge fixtures", () => {
  it("produces a deterministic UIState that App renders", async () => {
    render(<App bridge={fakeBridge()} view="panel" />);
    expect(await screen.findByText("Alex Morgan")).toBeVisible();
    expect(screen.getByText("1 connected")).toBeVisible();
  });

  it("surfaces state errors through App's alert banner", async () => {
    render(
      <App bridge={fakeBridge({ stateError: "Desktop connection lost" })} />,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Desktop connection lost",
    );
  });

  it("hangs state() for the connecting scenario without resolving", async () => {
    render(<App bridge={fakeBridge({ hangState: true })} />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Connecting to your accounts…",
    );
    expect(screen.queryByText("Alex Morgan")).toBeNull();
  });

  it("records calls for assertions", async () => {
    const bridge = fakeBridge();
    render(<App bridge={bridge} view="panel" />);
    (await screen.findByRole("button", { name: "Add account" })).click();
    await vi.waitFor(() =>
      expect(bridge.calls).toContainEqual({ method: "AddAccount", args: [] }),
    );
  });

  it("makeManyAccounts scales with unique ids and one active account", () => {
    const accounts = makeManyAccounts(12);
    expect(accounts).toHaveLength(12);
    expect(new Set(accounts.map((a) => a.id)).size).toBe(12);
    expect(accounts.filter((a) => a.active)).toHaveLength(1);
    expect(accounts[0]).toMatchObject(
      makeAccount({ id: "demo-1", usage: null }),
    );
  });

  it("makePrompt and makeUiState compose partial overrides", () => {
    const state = makeUiState({
      lang: "zh-CN",
      resume: makePrompt({ paused: false }),
      threshold: 85,
    });
    expect(state.lang).toBe("zh-CN");
    expect(state.threshold).toBe(85);
    expect(state.resume?.paused).toBe(false);
    expect(state.accounts[0].usage?.session).toBe(42);
  });
});
