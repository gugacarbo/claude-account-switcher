import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../window-frame";

const meta = {
  title: "App/Feedback",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export {
  CallErrorBanner,
  InvalidThreshold,
  OperationalBusyCall,
} from "../app.data";
