import { expect, type Page, type TestInfo } from "@playwright/test";

/**
 * Shared visual gates used by the matrix spec and the negative-gate spec:
 * - assertNoOverflow: no horizontal scroll and no element wider than the
 *   viewport (pure page evaluation, reusable on any page state);
 * - collectProblems: pageerror + console.error listeners with narrow,
 *   documented exceptions; asserted via afterEach.
 */

const CONSOLE_NOISE = [
  // Storybook inline-frame loader emits a benign resize-observer warning in
  // headless Chromium; it is tooling noise, not app behavior.
  /ResizeObserver/i,
];

export async function readOverflow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const viewport = document.documentElement.clientWidth;
    if (doc.scrollWidth > viewport) {
      return `document scrollWidth ${doc.scrollWidth} > viewport ${viewport}`;
    }
    const wide: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > viewport + 1) {
        const tag =
          el.tagName.toLowerCase() +
          (el.className && typeof el.className === "string"
            ? `.${el.className.split(" ").join(".")}`
            : "");
        wide.push(`${tag} right=${Math.round(rect.right)}`);
        if (wide.length >= 5) break;
      }
    }
    return wide.length ? wide.join("; ") : "";
  });
}

/** Fails with a descriptive message when the page overflows horizontally. */
export async function assertNoOverflow(page: Page): Promise<void> {
  const overflow = await readOverflow(page);
  expect(overflow, `horizontal overflow: ${overflow}`).toBe("");
}

export function watchProblems(page: Page): void {
  page.on("pageerror", (error) => {
    problemsOf(page).push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (CONSOLE_NOISE.some((pattern) => pattern.test(text))) return;
    problemsOf(page).push(`console.error: ${text}`);
  });
}

/** Throws when watchProblems collected any pageerror/console.error. */
export function assertNoProblems(
  page: Page,
  testInfo: TestInfo,
  label?: string,
): void {
  const found = problemsOf(page);
  if (found.length) {
    throw new Error(
      `unexpected runtime errors in ${label ?? testInfo.title}:\n${found.join("\n")}`,
    );
  }
}

function problemsOf(page: Page): string[] {
  // One array per page, hung off a symbol so parallel tests never share it.
  const key = Symbol.for("visual-gates-problems");
  const existing = (page as unknown as Record<symbol, string[]>)[key];
  if (existing) return existing;
  const created: string[] = [];
  (page as unknown as Record<symbol, string[]>)[key] = created;
  return created;
}
