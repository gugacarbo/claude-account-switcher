import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../window-frame";

const meta = {
  title: "Variants/Themes/Dark",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export {
  ManyAccountsDark,
  ManyAccountsZhDark,
  ThresholdDark,
} from "../app.data";
export { DarkControls } from "../components.data";
