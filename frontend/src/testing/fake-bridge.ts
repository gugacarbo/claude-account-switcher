import type { Account, Bridge, Prompt, UIState } from "../bridge";

/**
 * Shared fake bridge for stories and tests that render the real App.
 * Stories must exercise the actual App navigation instead of re-creating
 * screen compositions (docs/ui-contract.md, inventário de reuso).
 */

export function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "demo-1",
    name: "Alex Morgan",
    email: "alex@example.com",
    plan: "Pro",
    active: true,
    detail: "",
    usage: {
      session: 42,
      weekly: 68,
      sessionReset: "2030-01-01T12:00:00Z",
      weeklyReset: "2030-01-05T12:00:00Z",
      checkedAt: "2030-01-01T10:00:00Z",
    },
    ...overrides,
  };
}

export function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "prompt-1",
    account: "Alex Morgan",
    chats: [
      { title: "Workspace migration", folder: "/projects/demo" },
      { title: "Refactor billing", folder: "/projects/demo" },
    ],
    deadline: "2030-01-01T10:00:30Z",
    paused: true,
    ...overrides,
  };
}

const NAMES = [
  ["Alex Morgan", "alex@example.com", "Pro"],
  ["Lin Chen", "lin@example.com", "Max"],
  ["Priya Raman", "priya@example.com", "Pro"],
  ["Diego Costa", "diego@example.com", "Team"],
  ["Sam Okafor", "sam@example.com", "Max"],
  ["Yuki Tanaka", "yuki@example.com", "Pro"],
  ["Mara Vogel", "mara@example.com", "Team"],
] as const;

export function makeManyAccounts(count: number): Account[] {
  return Array.from({ length: count }, (_, i) => {
    const [name, email, plan] = NAMES[i % NAMES.length];
    return makeAccount({
      id: `demo-${i + 1}`,
      name: `${name}${i >= NAMES.length ? ` ${i + 1}` : ""}`,
      email,
      plan,
      active: i === 0,
      usage:
        i % 3 === 0
          ? null
          : {
              session: (i * 17) % 100,
              weekly: (i * 29) % 100,
              sessionReset: "2030-01-01T12:00:00Z",
              weeklyReset: "2030-01-05T12:00:00Z",
              checkedAt: "2030-01-01T10:00:00Z",
            },
    });
  });
}

export function makeUiState(overrides: Partial<UIState> = {}): UIState {
  return {
    accounts: [makeAccount()],
    autoSwitch: true,
    spendWeekly: false,
    sshImport: false,
    autostart: false,
    threshold: 96,
    thresholdOpening: 0,
    busy: false,
    status: "",
    note: "",
    update: "",
    version: "0.3.10",
    lang: "en",
    resume: null,
    ...overrides,
  };
}

export interface FakeBridgeOptions {
  /** UI state returned by state(); defaults to makeUiState(). */
  state?: UIState;
  /** When set, state() rejects with this message (error banner story). */
  stateError?: string;
  /** When true, state() never resolves (connecting/loading story). */
  hangState?: boolean;
  /** When set, every call() rejects with this message. */
  callError?: string;
}

export interface FakeBridge extends Bridge {
  /** Recorded calls, for assertions in tests. */
  calls: { method: string; args: unknown[] }[];
  /** Notifies state() subscribers (simulates a desktop state-changed event). */
  emit(): void;
}

export function fakeBridge(options: FakeBridgeOptions = {}): FakeBridge {
  const calls: FakeBridge["calls"] = [];
  const subscribers = new Set<() => void>();
  const bridge: Bridge = {
    state: async () => {
      if (options.hangState) return new Promise<UIState>(() => {});
      if (options.stateError) throw new Error(options.stateError);
      return options.state ?? makeUiState();
    },
    call: async (method, ...args) => {
      calls.push({ method, args });
      if (options.callError) throw new Error(options.callError);
      return undefined;
    },
    subscribe: (callback) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };
  return Object.assign(bridge, {
    calls,
    emit() {
      for (const callback of subscribers) callback();
    },
  });
}
