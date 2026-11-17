import type { Meta } from "@storybook/react-vite";

const meta = {
  title: "Components/Accounts/AccountCard",
  decorators: [
    (Story) => (
      <main style={{ maxWidth: 480 }}>
        <Story />
      </main>
    ),
  ],
} satisfies Meta;
export default meta;

export { ActiveAccount, NearlyFull, SignedOut } from "../components.data";
