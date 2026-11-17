import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../window-frame";

const meta = {
  title: "Variants/Localization",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export { ManyAccountsZh } from "../app.data";
