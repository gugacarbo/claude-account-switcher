import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseUsage } from "./capture-story";

describe("capture-story argument parsing", () => {
  test("accepts a story id and --out directory", () => {
    expect(parseUsage(["app--many-accounts", "--out", "/tmp/shots"])).toEqual({
      story: "app--many-accounts",
      out: "/tmp/shots",
      phase: "after",
    });
  });

  test("defaults the output directory and phase", () => {
    const parsed = parseUsage(["screens--min-width"]);
    expect(parsed.out).toBe("captures");
    expect(parsed.phase).toBe("after");
  });

  test("accepts --phase before and after", () => {
    expect(parseUsage(["app--busy-panel", "--phase", "before"]).phase).toBe(
      "before",
    );
    expect(parseUsage(["app--busy-panel", "--phase", "after"]).phase).toBe(
      "after",
    );
  });

  test("rejects an invalid --phase value (negative gate)", () => {
    expect(() => parseUsage(["app--busy-panel", "--phase", "middle"])).toThrow(
      /phase/i,
    );
    expect(() => parseUsage(["app--busy-panel", "--phase"])).toThrow(/phase/i);
  });

  test("rejects a missing story id (negative gate)", () => {
    expect(() => parseUsage(["--out", "/tmp/shots"])).toThrow(/story/i);
  });

  test("rejects story ids with path separators (no traversal into snapshots)", () => {
    expect(() => parseUsage(["../visual/screens.spec.ts-snapshots/x"])).toThrow(
      /path/i,
    );
    expect(() => parseUsage(["a/b--c"])).toThrow(/path/i);
  });

  test("target file stays inside the requested output directory", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "capture-story-test-"));
    const out = join(tmp, "out");
    await writeFile(join(tmp, "keep.txt"), "untouched");
    // parseUsage never writes; this asserts the resolved path shape.
    const { story, out: dir } = parseUsage(["app--busy-panel", "--out", out]);
    expect(join(dir, `${story}.png`)).toBe(join(out, "app--busy-panel.png"));
  });
});
