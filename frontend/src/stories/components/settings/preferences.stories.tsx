import type { Meta } from "@storybook/react-vite";

const meta = {
  title: "Components/Settings/Preferences",
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
  BusyPreferences,
  Preferences,
} from "../../components.data";
