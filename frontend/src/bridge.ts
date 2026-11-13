import type { UIState } from "./contracts.generated";

export type { Account, Prompt, UIState } from "./contracts.generated";
export interface Bridge {
  state(): Promise<UIState>;
  call(method: string, ...args: unknown[]): Promise<unknown>;
  subscribe(callback: () => void): () => void;
  subscribeNavigation?(callback: (section: string) => void): () => void;
}
declare global {
  interface Window {
    wails?: {
      Call: { ByID(id: number, ...args: unknown[]): Promise<unknown> };
      Events: {
        On(name: string, callback: (event: unknown) => void): () => void;
      };
    };
  }
}
type Runtime = NonNullable<Window["wails"]>;
type RuntimeModule = { default?: Runtime } | Runtime;
let runtimePromise: Promise<Runtime> | undefined;
async function loadRuntimeModule(): Promise<RuntimeModule> {
  // Runtime is supplied by the embedded Wails asset server, not a CDN/npm copy.
  const url = "/wails/runtime.js";
  return import(/* @vite-ignore */ url).catch(() => {
    throw new Error(
      "Desktop connection unavailable. Open this interface from Account Switcher.",
    );
  });
}
async function runtimeOf(
  modulePromise: Promise<RuntimeModule>,
): Promise<Runtime> {
  const mod = await modulePromise;
  const rt = (mod as { default?: Runtime }).default ?? (mod as Runtime);
  if (!rt || typeof rt.Call?.ByID !== "function") {
    throw new Error(
      "Desktop connection unavailable. Open this interface from Account Switcher.",
    );
  }
  return rt;
}
function runtime(): Promise<Runtime> {
  runtimePromise ??= runtimeOf(loadRuntimeModule());
  return runtimePromise;
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
// Legacy Go paths emit a bare section name ("settings" | "threshold") on the
// "navigate" event. The Wails SDK wraps payloads in a WailsEvent (.data), so
// both shapes are accepted and anything else is ignored.
export function subscribeNavigation(
  callback: (section: string) => void,
  runtimeSupplier: () => Promise<RuntimeModule> = loadRuntimeModule,
): () => void {
  let active = true;
  let off = () => {};
  runtimeOf(runtimeSupplier())
    .then((r) => {
      if (!active) return;
      off = r.Events.On("navigate", (event: unknown) => {
        const data =
          typeof event === "string"
            ? event
            : (event as { data?: unknown } | null)?.data;
        if (data === "settings" || data === "threshold") callback(data);
      });
    })
    .catch(() => {});
  return () => {
    active = false;
    off();
  };
}

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
  subscribeNavigation: (callback) => subscribeNavigation(callback),
};
