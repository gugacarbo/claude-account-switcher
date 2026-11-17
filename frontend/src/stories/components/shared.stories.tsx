import type { Meta } from "@storybook/react-vite";

const meta = {
  title: "Components/Shared/WindowHeader",
  decorators: [
    (Story) => (
      <main style={{ maxWidth: 480 }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta;
export default meta;

export {
  UnifiedNavigationStates,
  WindowHeaderInteractive,
} from "../components.data";
