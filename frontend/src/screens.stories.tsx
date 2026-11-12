import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Account, UIState } from "./bridge";
import { AccountCard } from "./features/accounts/AccountCard";
import { Resume } from "./features/resume/Resume";
import { Settings } from "./features/settings/Settings";
import { Threshold } from "./features/settings/Threshold";

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
