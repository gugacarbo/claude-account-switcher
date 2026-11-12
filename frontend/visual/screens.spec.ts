import { expect, test } from "@playwright/test";

for (const story of [
  "active-account",
  "nearly-full",
  "signed-out",
  "preferences",
  "busy-preferences",
  "switch-threshold",
  "resume-chats",
  "no-resume",
]) {
  test(story, async ({ page }) => {
    await page.clock.setFixedTime(new Date("2030-01-01T10:00:00Z"));
    await page.goto(`/iframe.html?id=screens--${story}&viewMode=story`);
    await expect(page.locator("#storybook-root main")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${story}.png`, {
      animations: "disabled",
    });
  });
}
