import { expect, test } from "@playwright/test";
import { assertNoOverflow, assertNoProblems, watchProblems } from "./gates";

/**
 * E2/E3 visual matrix. Stories render the real App (see src/app.stories.tsx),
 * so this spec exercises actual composition, not hand-built duplicates.
 *
 * Gates applied to every capture:
 * - overflow: no horizontal scroll and no element wider than the viewport;
 * - unexpected pageerror / console.error fail the test, with narrow
 *   exceptions (Storybook + jsdom-only noise documented inline).
 * Both live in ./gates and are reused by the negative-gate spec.
 *
 * Baseline snapshots live in visual/*-snapshots and are only updated
 * deliberately via `bun run test:visual:update`.
 */

const clock = async (page: import("@playwright/test").Page) => {
  await page.clock.setFixedTime(new Date("2030-01-01T10:00:00Z"));
};

async function openStory(page: import("@playwright/test").Page, id: string) {
  await page.goto(`/iframe.html?id=${id}&viewMode=story`);
  await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ page }) => {
  watchProblems(page);
});

test.afterEach(async ({ page }, testInfo) => {
  assertNoProblems(page, testInfo);
});

const MATRIX: {
  story: string;
  viewport?: { width: number; height: number };
}[] = [
  // App-level states (real App through the shared fake bridge).
  { story: "app--connecting" },
  { story: "app--bridge-error" },
  { story: "app--empty-accounts" },
  { story: "app--busy-panel" },
  { story: "app--many-accounts" },
  { story: "app--many-accounts-zh" },
  { story: "app--panel-with-update" },
  { story: "app--auto-switch-off" },
  { story: "app--threshold-opening-shown" },
  { story: "app--checked-note" },
  { story: "app--unified-threshold" },
  { story: "app--resume-window" },
  { story: "app--resume-empty" },
  { story: "app--long-titles-app" },
  // Dark themes (explicit palette; see story file).
  { story: "app--many-accounts-dark" },
  { story: "app--many-accounts-zh-dark" },
  { story: "app--threshold-dark" },
  // Real App with a signed-out card (empty usage state).
  { story: "app--signed-out-account" },
  // Minimal window sizes (420x640 initial, 360x360 minimum per contract).
  { story: "app--many-accounts", viewport: { width: 420, height: 640 } },
  { story: "app--many-accounts", viewport: { width: 360, height: 360 } },
  { story: "app--long-titles-app", viewport: { width: 360, height: 360 } },
  { story: "app--many-accounts-zh", viewport: { width: 360, height: 360 } },
  { story: "app--resume-window", viewport: { width: 360, height: 360 } },
  {
    story: "app--many-accounts-zh-dark",
    viewport: { width: 360, height: 360 },
  },
  // Component stories that complement the matrix.
  { story: "screens--dark-controls" },
  { story: "screens--long-titles" },
  { story: "screens--min-width" },
];

for (const { story, viewport } of MATRIX) {
  const label = viewport
    ? `${story}-${viewport.width}x${viewport.height}`
    : story;
  test(`visual matrix: ${label}`, async ({ page }) => {
    if (viewport) await page.setViewportSize(viewport);
    await clock(page);
    await openStory(page, story);
    if (viewport) {
      // Allow one paint for the viewport change before capturing.
      await page.waitForTimeout(50);
    }
    await assertNoOverflow(page);
    await expect(page.locator("#storybook-root")).toBeVisible();
    await expect(page).toHaveScreenshot(`${label}.png`, {
      animations: "disabled",
    });
  });
}
