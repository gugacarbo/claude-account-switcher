import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { Account, UIState } from "./bridge";
import { AccountCard } from "./features/accounts/AccountCard";
import { Resume } from "./features/resume/Resume";
import { Settings } from "./features/settings/Settings";
import { Threshold } from "./features/settings/Threshold";
import { SettingsIcon } from "./shared/Icons";
import { WindowHeader } from "./shared/WindowHeader";

const t = (en: string) => en;
const act = async () => true;
const state: UIState = {
  accounts: [],
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
};
const account: Account = {
  id: "demo",
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
};
const meta = {
  title: "Screens",
  decorators: [
    (Story) => (
      <main style={{ maxWidth: 480 }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;
export const ActiveAccount: Story = {
  render: () => (
    <AccountCard
      account={account}
      threshold={96}
      t={t}
      disabled={false}
      onSwitch={() => {}}
    />
  ),
};
export const NearlyFull: Story = {
  render: () => (
    <AccountCard
      account={{
        ...account,
        active: false,
        usage: { ...account.usage!, session: 98 },
      }}
      threshold={96}
      t={t}
      disabled={false}
      onSwitch={() => {}}
    />
  ),
};
export const SignedOut: Story = {
  render: () => (
    <AccountCard
      account={{
        ...account,
        active: false,
        usage: null,
        detail: "Signed out, add it again",
      }}
      threshold={96}
      t={t}
      disabled={false}
      onSwitch={() => {}}
    />
  ),
};
export const Preferences: Story = {
  render: () => <Settings state={state} t={t} disabled={false} act={act} />,
};
export const BusyPreferences: Story = {
  render: () => <Settings state={state} t={t} disabled={true} act={act} />,
};
export const SwitchThreshold: Story = {
  render: () => <Threshold state={state} t={t} disabled={false} act={act} />,
};
export const ResumeChats: Story = {
  render: () => (
    <Resume
      prompt={{
        id: "prompt",
        account: "Alex Morgan",
        chats: [{ title: "Workspace migration", folder: "/projects/demo" }],
        deadline: "2030-01-01T10:00:30Z",
        paused: true,
      }}
      t={t}
      disabled={false}
      act={act}
    />
  ),
};
export const NoResume: Story = {
  render: () => <Resume prompt={null} t={t} disabled={false} act={act} />,
};

// Interactive stories exercise the real handlers passed by App.
export const WindowHeaderInteractive: Story = {
  render: () => {
    const [screen, setScreen] = useState<"panel" | "settings">("panel");
    return (
      <>
        <WindowHeader
          title={
            screen === "panel" ? "A little more room." : "Make it work for you"
          }
          t={t}
          onBack={screen === "settings" ? () => setScreen("panel") : undefined}
          onClose={() => setScreen("panel")}
        >
          {screen === "panel" ? (
            <button
              type="button"
              className="window-header-button"
              aria-label="Settings"
              onClick={() => setScreen("settings")}
            >
              <SettingsIcon />
            </button>
          ) : null}
        </WindowHeader>
        {screen === "settings" ? (
          <Settings state={state} t={t} disabled={false} act={act} />
        ) : (
          <AccountCard
            account={account}
            threshold={96}
            t={t}
            disabled={false}
            onSwitch={() => {}}
          />
        )}
      </>
    );
  },
};

// Back control appears only on nested screens; close always targets the
// unified panel window from any screen.
export const UnifiedNavigationStates: Story = {
  render: () => {
    const [screen, setScreen] = useState<"panel" | "settings" | "threshold">(
      "panel",
    );
    return (
      <>
        <WindowHeader
          title={
            screen === "settings"
              ? "Make it work for you"
              : screen === "threshold"
                ? "Choose your limit"
                : "A little more room."
          }
          t={t}
          onBack={
            screen !== "panel"
              ? () => setScreen(screen === "threshold" ? "settings" : "panel")
              : undefined
          }
          onClose={() => setScreen("panel")}
        >
          {screen === "panel" ? (
            <button
              type="button"
              className="window-header-button"
              aria-label="Settings"
              onClick={() => setScreen("settings")}
            >
              <SettingsIcon />
            </button>
          ) : null}
        </WindowHeader>
        {screen === "settings" ? (
          <Settings
            state={state}
            t={t}
            disabled={false}
            act={act}
            onOpenThreshold={() => setScreen("threshold")}
          />
        ) : screen === "threshold" ? (
          <Threshold
            state={state}
            t={t}
            disabled={false}
            act={act}
            onCancel={() => setScreen("settings")}
            onComplete={() => setScreen("settings")}
          />
        ) : (
          <AccountCard
            account={account}
            threshold={96}
            t={t}
            disabled={false}
            onSwitch={() => {}}
          />
        )}
      </>
    );
  },
};

// Dark scheme of the shared controls: the media query does not fire in CI
// (colorScheme is pinned to light), so the dark palette is applied explicitly.
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
export const DarkControls: Story = {
  render: () => (
    <main className="app" style={{ maxWidth: 480, ...darkPalette }}>
      <WindowHeader
        title="Choose your limit"
        t={t}
        onBack={() => {}}
        onClose={() => {}}
      />
      <Threshold state={state} t={t} disabled={false} act={act} />
    </main>
  ),
};

// Long content must not break the header layout; the title ellipsizes and the
// identity wraps without pushing controls off screen.
export const LongTitles: Story = {
  render: () => (
    <main className="app" style={{ maxWidth: 480 }}>
      <WindowHeader
        title="A very long window title that should ellipsize gracefully instead of pushing the controls off screen"
        t={t}
        onBack={() => {}}
        onClose={() => {}}
      />
      <AccountCard
        account={{
          ...account,
          name: "Alexandra Marmalade-Constantinopoulous-McAllister the Third",
          email:
            "alexandra.marmalade.constantinopoulous.mcallister@example.com",
        }}
        threshold={96}
        t={t}
        disabled={false}
        onSwitch={() => {}}
      />
    </main>
  ),
};

// Narrow minimum-width rendering (370px CSS breakpoint and below).
export const MinWidth: Story = {
  render: () => (
    <main className="app" style={{ width: 340 }}>
      <WindowHeader
        title="Choose your limit"
        t={t}
        onBack={() => {}}
        onClose={() => {}}
      />
      <Threshold state={state} t={t} disabled={false} act={act} />
    </main>
  ),
};
