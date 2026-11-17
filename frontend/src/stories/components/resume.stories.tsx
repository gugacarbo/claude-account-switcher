import type { Meta } from "@storybook/react-vite";

const meta = {
  title: "Components/Resume",
  decorators: [
    (Story) => (
      <main style={{ maxWidth: 480 }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta;
export default meta;

export { NoResume, ResumeChats } from "../components.data";
