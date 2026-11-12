// Generated from Go JSON DTOs. Run bun run generate:contract; do not edit.
export interface Usage {
  checkedAt: string;
  session: number;
  sessionReset: string;
  weekly: number;
  weeklyReset: string;
}
export interface Account {
  active: boolean;
  detail: string;
  email: string;
  id: string;
  name: string;
  plan: string;
  usage: Usage | null;
}
export interface Prompt {
  account: string;
  chats: ({ title: string; folder: string; })[];
  deadline: string;
  id: string;
  paused: boolean;
}
export interface UIState {
  accounts: (Account)[];
  autoSwitch: boolean;
  autostart: boolean;
  busy: boolean;
  lang: string;
  note: string;
  resume: Prompt | null;
  spendWeekly: boolean;
  sshImport: boolean;
  status: string;
  threshold: number;
  thresholdOpening: number;
  update: string;
  version: string;
}
