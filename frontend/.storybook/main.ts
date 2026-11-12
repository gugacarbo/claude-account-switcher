import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  core: { disableTelemetry: true },
  viteFinal: (config) => ({
    ...config,
    resolve: { ...config.resolve, dedupe: ["react", "react-dom"] },
  }),
};
export default config;
