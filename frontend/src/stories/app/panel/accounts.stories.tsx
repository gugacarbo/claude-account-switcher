import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../../window-frame";

const meta = {
  title: "App/Panel/Accounts",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export { EmptyAccounts, ManyAccounts, SignedOutAccount } from "../../app.data";
