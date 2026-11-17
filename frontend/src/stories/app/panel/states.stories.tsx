import type { Meta } from "@storybook/react-vite";
import { panelFrame } from "../../window-frame";

const meta = {
  title: "App/Panel/States",
  parameters: { layout: "fullscreen" },
  decorators: [panelFrame],
} satisfies Meta;
export default meta;

export { BusyPanel, CheckedNote, PanelWithUpdate } from "../../app.data";
