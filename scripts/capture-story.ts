#!/usr/bin/env bun
/**
 * Capture a story snapshot before/after a change with fixture data only.
 *
 * Usage:
 *   bun run capture:story -- <story-id> [--phase before|after] [--out <dir>]
 *   bun run capture:story -- app--many-accounts --phase before --out /tmp/captures
 *
 * Builds Storybook, serves the static build, loads the story in headless
 * Chromium and writes <story-id>.png into the output directory. Run it on the
 * base commit and on the working tree, then diff the two PNGs (or feed both
 * paths to `git diff --no-index --word-diff` visually). Existing baselines in
 * frontend/visual/*-snapshots are never touched by this script.
 *
 * Fictitious data only: stories must render the shared fake bridge fixtures
 * (frontend/src/testing/fake-bridge.ts), never real accounts.
 */

import { mkdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

/** Validates CLI arguments; exported for the negative-gate unit tests. */
export function parseUsage(argv: string[]): {
  story: string;
  out: string;
  phase: "before" | "after";
} {
  let story = "";
  let out = "captures";
  let phase: "before" | "after" = "after";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i] ?? out;
    else if (argv[i] === "--phase") {
      const value = argv[++i];
      if (value !== "before" && value !== "after") {
        throw new Error('capture:story: --phase aceita "before" ou "after"');
      }
      phase = value;
    } else if (!argv[i].startsWith("--") && !story) story = argv[i];
  }
  if (!story) {
    throw new Error(
      "capture:story: informe o story id (ex.: app--many-accounts)",
    );
  }
  if (story.includes("/") || story.includes("\\")) {
    throw new Error(
      "capture:story: story id não pode conter separadores de path",
    );
  }
  return { story, out, phase };
}

function serve(dir: string, port: number): number {
  const server = Bun.serve({
    port,
    async fetch(request) {
      const url = new URL(request.url);
      let path = decodeURIComponent(url.pathname);
      if (path === "/") path = "/index.html";
      const file = Bun.file(join(dir, path));
      if (await file.exists()) return new Response(file);
      return new Response("not found", { status: 404 });
    },
  });
  process.on("exit", () => server.stop(true));
  return server.port;
}

// Resolves playwright-core from the frontend workspace install without
// brittle paths: node-style resolution first, bun store layout as fallback.
async function loadChromium(): Promise<{
  chromium: { launch(options?: unknown): Promise<unknown> };
}> {
  const frontendDir = resolve("frontend");
  const specifiers = [
    (() => {
      try {
        return Bun.resolveSync("playwright-core", frontendDir);
      } catch {
        return null;
      }
    })(),
    join(frontendDir, "node_modules/playwright-core/index.mjs"),
  ].filter((value): value is string => !!value);
  for (const specifier of specifiers) {
    try {
      return await import(specifier);
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    "capture:story: playwright-core não encontrado; rode `bun install` no workspace",
  );
}

export async function main(argv: string[]): Promise<number> {
  const { story, out, phase } = parseUsage(argv);

  const storybookDir = resolve("frontend/storybook-static");
  const built = await stat(join(storybookDir, "index.html")).catch(() => null);
  if (!built) {
    console.error(
      "capture:story: frontend/storybook-static não encontrado; rode `bun run build:storybook` primeiro",
    );
    return 1;
  }

  await mkdir(out, { recursive: true });
  const port = serve(storybookDir, 0);
  const url = `http://127.0.0.1:${port}`;

  // playwright-core ships with @playwright/test in the frontend workspace; the
  // dynamic import keeps `bun test scripts/` from resolving it at load time.
  const { chromium } = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 520, height: 720 },
      locale: "en-US",
      colorScheme: "light",
      timezoneId: "UTC",
    });
    await page.clock.setFixedTime(new Date("2030-01-01T10:00:00Z"));
    await page.goto(`${url}/iframe.html?id=${story}&viewMode=story`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(250);
    const target = join(out, `${phase}-${story}.png`);
    await page.screenshot({ path: target, animations: "disabled" });
    console.log(`capture:story: ${target}`);
  } finally {
    await browser.close();
  }
  return 0;
}

// Main guard: importing this module (e.g. from bun test scripts/) must not
// launch a browser or serve a static build.
if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
