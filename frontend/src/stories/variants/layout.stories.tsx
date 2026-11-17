import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../window-frame";

const meta = {
  title: "Variants/Layout",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export { LongTitlesApp } from "../app.data";
export { LongTitles, MinWidth } from "../components.data";
