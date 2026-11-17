import type { Meta } from "@storybook/react-vite";
import { trayFrame } from "../window-frame";

const meta = {
  title: "App/Tray",
  parameters: { layout: "fullscreen" },
  decorators: [trayFrame],
} satisfies Meta;
export default meta;

export { TrayMenuView, TrayThreeAccounts } from "../app.data";
