import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../../window-frame";

const meta = {
  title: "App/Panel/Connection",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export { BridgeError, Connecting } from "../../app.data";
