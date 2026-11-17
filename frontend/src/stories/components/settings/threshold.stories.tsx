import type { Meta } from "@storybook/react-vite";

const meta = {
  title: "Components/Settings/Threshold",
  decorators: [
    (Story) => (
      <main style={{ maxWidth: 480 }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta;
export default meta;

export { SwitchThreshold } from "../../components.data";
