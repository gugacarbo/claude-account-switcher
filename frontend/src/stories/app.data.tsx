import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { App } from "../App";
import type { UIState } from "../bridge";
import {
  type FakeBridge,
  fakeBridge,
  makeAccount,
  makeManyAccounts,
  makePrompt,
  makeUiState,
} from "../testing/fake-bridge";

/**
 * Stories render the REAL App with the shared fake bridge: navigation,
 * headers and state flow come from App itself, never re-created here
 * (docs/ui-contract.md). The fixed clock matches frontend/visual specs
 * (2030-01-01T10:00:00Z, see frontend/visual/screens.spec.ts).
 */

function stateWith(overrides: Partial<UIState>): UIState {
  return makeUiState(overrides);
}

const meta = {
  parameters: {
    // Full-bleed frame: App brings its own .app container and header.
    layout: "fullscreen",
  },
} satisfies Meta;
type Story = StoryObj<typeof meta>;

export const Connecting: Story = {
  render: () => <App bridge={fakeBridge({ hangState: true })} />,
};

export const BridgeError: Story = {
  render: () => (
    <App
      bridge={fakeBridge({ stateError: "Desktop connection unavailable" })}
    />
  ),
};

export const EmptyAccounts: Story = {
  render: () => (
    <App bridge={fakeBridge({ state: stateWith({ accounts: [] }) })} />
  ),
};

export const BusyPanel: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({
          busy: true,
          note: "Switching to Lin Chen…",
        }),
      })}
    />
  ),
};

export const ManyAccounts: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ accounts: makeManyAccounts(7) }),
      })}
    />
  ),
};

export const PanelWithUpdate: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ update: "0.4.0", status: "Update downloaded" }),
      })}
    />
  ),
};

export const UnifiedSettings: Story = {
  render: () => {
    const [bridge] = useState<FakeBridge>(() => fakeBridge());
    return <App bridge={bridge} view="panel" />;
  },
};

export const UnifiedThreshold: Story = {
  render: () => {
    const [bridge] = useState<FakeBridge>(() => fakeBridge());
    return <ThresholdFlow bridge={bridge} />;
  },
};

function ThresholdFlow({ bridge }: { bridge: FakeBridge }) {
  // Drive the real unified panel to the threshold screen via the desktop
  // navigate event, keeping App's own navigation code under test.
  useEffect(() => {
    const timer = setTimeout(() => bridge.emit(), 0);
    return () => clearTimeout(timer);
  }, [bridge]);
  return <App bridge={withNavigation(bridge, "threshold")} view="panel" />;
}

function withNavigation(bridge: FakeBridge, section: string): FakeBridge {
  return Object.assign(bridge, {
    subscribeNavigation: (callback: (value: string) => void) => {
      callback(section);
      return () => {};
    },
  });
}

export const ResumeWindow: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ resume: makePrompt() }),
      })}
      view="resume"
    />
  ),
};

export const ResumeEmpty: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ resume: null }),
      })}
      view="resume"
    />
  ),
};

export const ResumeManyChats: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({
          resume: makePrompt({
            chats: Array.from({ length: 12 }, (_, index) => ({
              title: `Project conversation ${index + 1}`,
              folder: `/projects/project-${index + 1}`,
            })),
          }),
        }),
      })}
      view="resume"
    />
  ),
};

export const TrayMenuView: Story = {
  render: () => {
    const now = Date.now();
    const account = makeAccount({
      usage: {
        session: 42,
        weekly: 68,
        sessionReset: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        weeklyReset: new Date(
          now + (4 * 24 * 60 + 2 * 60) * 60 * 1000,
        ).toISOString(),
        checkedAt: new Date(now).toISOString(),
      },
    });
    return (
      <App
        bridge={fakeBridge({ state: stateWith({ accounts: [account] }) })}
        view="menu"
      />
    );
  },
};

export const TraySwitchConfirmation: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({
          resume: makePrompt({
            chats: Array.from({ length: 5 }, (_, index) => ({
              title: `Active project ${index + 1}`,
              folder: `/projects/active-${index + 1}`,
            })),
          }),
        }),
      })}
      view="menu"
    />
  ),
};

export const TrayThreeAccounts: Story = {
  render: () => {
    const now = Date.now();
    const accounts = makeManyAccounts(3).map((account, index) => ({
      ...account,
      active: index === 0,
      email:
        index === 1
          ? "lin.chen.with.a.very.long.email.address.for.tray.overflow@example.com"
          : account.email,
      usage: {
        session: account.usage?.session ?? 42,
        weekly: account.usage?.weekly ?? 68,
        sessionReset: new Date(
          now + (index + 1) * 60 * 60 * 1000,
        ).toISOString(),
        weeklyReset: new Date(
          now + (index + 2) * 24 * 60 * 60 * 1000,
        ).toISOString(),
        checkedAt: new Date(now).toISOString(),
      },
    }));
    return (
      <App
        bridge={fakeBridge({ state: stateWith({ accounts }) })}
        view="menu"
      />
    );
  },
};

export const ManyAccountsZh: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({
          lang: "zh-CN",
          accounts: makeManyAccounts(7),
        }),
      })}
    />
  ),
};

export const LongTitlesApp: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({
          accounts: [
            makeAccount({
              name: "Alexandra Marmalade-Constantinopoulous-McAllister",
              email:
                "alexandra.marmalade.constantinopoulous.mcallister@example.com",
            }),
          ],
        }),
      })}
    />
  ),
};

export const OperationalBusyCall: Story = {
  render: () => {
    const [bridge] = useState<FakeBridge>(() => fakeBridge());
    return <BusyFlow bridge={bridge} />;
  },
};

function BusyFlow({ bridge }: { bridge: FakeBridge }) {
  useEffect(() => {
    const timer = setTimeout(() => bridge.emit(), 0);
    return () => clearTimeout(timer);
  }, [bridge]);
  return <App bridge={withBusyCall(bridge)} view="panel" />;
}

function withBusyCall(bridge: FakeBridge): FakeBridge {
  return Object.assign(bridge, {
    call: async (method: string, ...args: unknown[]) => {
      bridge.calls.push({ method, args });
      return undefined;
    },
  });
}

export const CallErrorBanner: Story = {
  render: () => {
    const [bridge] = useState<FakeBridge>(() => fakeBridge());
    return <ErrorFlow bridge={bridge} />;
  },
};

function ErrorFlow({ bridge }: { bridge: FakeBridge }) {
  useEffect(() => {
    const timer = setTimeout(() => bridge.emit(), 0);
    return () => clearTimeout(timer);
  }, [bridge]);
  return <App bridge={withFailingCall(bridge)} view="panel" />;
}

function withFailingCall(bridge: FakeBridge): FakeBridge {
  return Object.assign(bridge, {
    call: async (method: string, ...args: unknown[]) => {
      bridge.calls.push({ method, args });
      throw new Error("Account switch failed: desktop is busy");
    },
  });
}

export const AutoSwitchOff: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ autoSwitch: false }),
      })}
    />
  ),
};

export const ThresholdOpeningShown: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ thresholdOpening: 120 }),
      })}
    />
  ),
};

export const CheckedNote: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({ note: "Last checked just now" }),
      })}
    />
  ),
};

// Dark scheme of the real App: the media query does not fire in CI
// (colorScheme is pinned to light), so the dark palette is applied explicitly
// on a wrapper; custom properties cascade into App unchanged.
const darkPalette = {
  background: "#242421",
  color: "#eeeae1",
  "--bg": "#242421",
  "--card": "#2d2d28",
  "--text": "#eeeae1",
  "--muted": "#b0aa9d",
  "--line": "#45443c",
  "--accent": "#ed9b7b",
  "--accent-soft": "#443129",
  "--green": "#a5c89a",
  "--shadow": "none",
} as CSSProperties;

function DarkApp({ children }: { children: ReactNode }) {
  return <div style={darkPalette}>{children}</div>;
}

export const ManyAccountsDark: Story = {
  render: () => (
    <DarkApp>
      <App
        bridge={fakeBridge({
          state: stateWith({ accounts: makeManyAccounts(7) }),
        })}
      />
    </DarkApp>
  ),
};

export const ManyAccountsZhDark: Story = {
  render: () => (
    <DarkApp>
      <App
        bridge={fakeBridge({
          state: stateWith({
            lang: "zh-CN",
            accounts: makeManyAccounts(7),
          }),
        })}
      />
    </DarkApp>
  ),
};

export const ThresholdDark: Story = {
  render: () => {
    const [bridge] = useState<FakeBridge>(() => fakeBridge());
    return (
      <DarkApp>
        <ThresholdFlow bridge={bridge} />
      </DarkApp>
    );
  },
};

// Signed-out account inside the real App panel: the card renders its empty
// usage state with the shared fake bridge fixtures.
export const SignedOutAccount: Story = {
  render: () => (
    <App
      bridge={fakeBridge({
        state: stateWith({
          accounts: [
            makeAccount({ active: false, usage: null, detail: "Signed out" }),
          ],
        }),
      })}
    />
  ),
};

// Invalid threshold entry inside the real unified threshold screen: drives
// the same desktop navigate event used by UnifiedThreshold, then lets the
// test type an out-of-range value; the fine-print warning comes from
// Threshold's own validation.
export const InvalidThreshold: Story = {
  render: () => {
    const [bridge] = useState<FakeBridge>(() => fakeBridge());
    return <ThresholdFlow bridge={bridge} />;
  },
};
