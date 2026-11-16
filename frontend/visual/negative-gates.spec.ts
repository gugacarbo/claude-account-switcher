import { expect, test } from "@playwright/test";
import { assertNoProblems, readOverflow, watchProblems } from "./gates";

/**
 * Negative gates: deterministic and baseline-free. They must FAIL on a
 * broken page (proving the gate works) and never touch snapshot baselines.
 *
 * The broken page is synthetic (page.setContent), so these tests do not
 * depend on Storybook build state; the console/pageerror half also runs
 * against a real story when the Storybook server is up, via the shared
 * gates module.
 */

test.beforeEach(async ({ page }) => {
  watchProblems(page);
});

test("gate detects injected horizontal overflow (negative, deterministic)", async ({
  page,
}) => {
  await page.setContent(
    `<style>html,body{margin:0}</style>
     <div style="width:2000px;height:50px;background:#333">wide</div>`,
  );
  const overflow = await readOverflow(page);
  expect(overflow).not.toBe("");
  expect(overflow).toMatch(/scrollWidth 2000|right=/i);
});

test("gate passes on a clean page (control)", async ({ page }) => {
  await page.setContent(
    `<style>html,body{margin:0}</style>
     <div style="width:200px;height:50px">ok</div>`,
  );
  expect(await readOverflow(page)).toBe("");
});

test("gate detects an injected pageerror (negative, deterministic)", async ({
  page,
}, testInfo) => {
  await page.setContent(
    `<button onclick="window.__boom()">boom</button>
     <script>
       function __boom() { throw new Error("injected boom"); }
     </script>`,
  );
  await page.click("button");
  // Wait one tick for the console event to propagate to the Node listener.
  await page.waitForTimeout(100);
  expect(() => expect("").toThrow()).not;
  const problems = (() => {
    try {
      assertNoProblems(page, testInfo, "injected pageerror");
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  })();
  expect(problems).toMatch(/pageerror: injected boom/);
});

test("gate detects an injected console.error (negative, deterministic)", async ({
  page,
}, testInfo) => {
  await page.setContent(`<script>console.error("injected error")</script>`);
  await page.waitForTimeout(100);
  const problems = (() => {
    try {
      assertNoProblems(page, testInfo, "injected console.error");
      return "";
    } catch (error) {
      return (error as Error).message;
    }
  })();
  expect(problems).toMatch(/console\.error: injected error/);
});

test("ResizeObserver noise stays whitelisted (control)", async ({
  page,
}, testInfo) => {
  await page.setContent(
    `<script>console.error("ResizeObserver loop completed with undelivered notifications.")</script>`,
  );
  await page.waitForTimeout(100);
  // Must NOT throw: this pattern is documented tooling noise.
  assertNoProblems(page, testInfo, "resize observer noise");
});

test("keyboard/focus: settings opens via keyboard and threshold receives focus", async ({
  page,
}) => {
  // Real App through Storybook (panel -> settings -> threshold), keyboard only.
  await page.clock.setFixedTime(new Date("2030-01-01T10:00:00Z"));
  await page.goto(`/iframe.html?id=app--many-accounts&viewMode=story`);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("main.app")).toBeVisible();

  // Open settings with the keyboard (header settings button).
  await page.getByRole("button", { name: "Settings" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main.app.settings")).toBeVisible();

  // Open the threshold screen from settings, again keyboard only.
  await page
    .getByRole("button", { name: /change|threshold|limit/i })
    .first()
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main.app.threshold")).toBeVisible();

  // The threshold number input is reachable and focusable by keyboard.
  const input = page.getByLabel("Threshold in percent");
  await input.focus();
  await expect(input).toBeFocused();
  // Typing an out-of-range value must not submit; validation message appears.
  await input.fill("150");
  await expect(page.getByRole("status")).toContainText(/1 to 99/);
});
