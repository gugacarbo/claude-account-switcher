import type { Meta } from "@storybook/react-vite";
import { resumeFrame } from "../window-frame";

const meta = {
  title: "App/Resume",
  parameters: { layout: "fullscreen" },
  decorators: [resumeFrame],
} satisfies Meta;
export default meta;

export { ResumeEmpty, ResumeManyChats, ResumeWindow } from "../app.data";
