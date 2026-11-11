export interface Usage {
  session: number;
  weekly: number;
  sessionReset: string;
  weeklyReset: string;
  checkedAt: string;
}
export interface Account {
  id: string;
  name: string;
  email: string;
  plan: string;
  active: boolean;
  detail: string;
  usage: Usage | null;
}
export interface Prompt {
  id: string;
  account: string;
  chats: { title: string; folder: string }[];
  deadline: string;
  paused: boolean;
}
export interface UIState {
  accounts: Account[];
  autoSwitch: boolean;
  spendWeekly: boolean;
  sshImport: boolean;
  autostart: boolean;
  threshold: number;
  thresholdOpening: number;
  busy: boolean;
  status: string;
  note: string;
  update: string;
  version: string;
  lang: string;
  resume: Prompt | null;
}
export interface Bridge {
  state(): Promise<UIState>;
  call(method: string, ...args: unknown[]): Promise<unknown>;
  subscribe(callback: () => void): () => void;
}
declare global {
  interface Window {
    wails?: {
      Call: { ByID(id: number, ...args: unknown[]): Promise<unknown> };
      Events: { On(name: string, callback: () => void): () => void };
    };
  }
}
type Runtime = NonNullable<Window["wails"]>;
let runtimePromise: Promise<Runtime> | undefined;
function runtime(): Promise<Runtime> {
  // Runtime is supplied by the embedded Wails asset server, not a CDN/npm copy.
  const url = "/wails/runtime.js";
  return (runtimePromise ??= import(/* @vite-ignore */ url).catch(() => {
    throw new Error(
      "Desktop connection unavailable. Open this interface from Account Switcher.",
    );
  }));
}
const methods: Record<string, number> = {
  State: 1,
  SetThreshold: 2,
  SetOption: 3,
  SwitchAccount: 4,
  AddAccount: 5,
  ImportChats: 6,
  InstallUpdate: 7,
  OpenDataFolder: 8,
  OpenWindow: 9,
  CloseWindow: 10,
  Quit: 11,
  AnswerResume: 12,
  PauseResume: 13,
};
export const desktopBridge: Bridge = {
  state: async () =>
    (await runtime()).Call.ByID(methods.State) as Promise<UIState>,
  call: async (name, ...args) => {
    if (!methods[name]) throw new Error("Unknown desktop command");
    return (await runtime()).Call.ByID(methods[name], ...args);
  },
  subscribe: (callback) => {
    let active = true;
    let off = () => {};
    runtime()
      .then((r) => {
        if (active) off = r.Events.On("state-changed", callback);
      })
      .catch(() => {});
    return () => {
      active = false;
      off();
    };
  },
};
