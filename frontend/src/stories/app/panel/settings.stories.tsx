import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../../window-frame";

const meta = {
  title: "App/Panel/Settings",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export {
  AutoSwitchOff,
  ThresholdOpeningShown,
  UnifiedSettings,
  UnifiedThreshold,
} from "../../app.data";
