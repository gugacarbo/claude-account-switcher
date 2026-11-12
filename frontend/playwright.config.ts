import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:6006",
    browserName: "chromium",
    viewport: { width: 520, height: 720 },
    locale: "en-US",
    timezoneId: "UTC",
    colorScheme: "light",
  },
  webServer: {
    command: "bun run storybook --ci --host 127.0.0.1",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
