import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  baselineAtCommit,
  baselineGrowth,
  bootstrapProblems,
  collectViolations,
  describeViolation,
  EMPTY_BASELINE,
  findBrowserDialogs,
  findHeaderViolations,
  findRawColors,
  isUiSourceFile,
  pruneBaseline,
  resolveBaseRef,
  runGit,
  type UiSource,
  uncoveredComponents,
} from "./check-ui";

const src = (file: string, source: string): UiSource => ({ file, source });

async function mkdtempScratch(): Promise<{
  pathname: string;
  [Symbol.asyncDispose]: () => Promise<void>;
}> {
  const dir = await mkdtemp(join(tmpdir(), "check-ui-test-"));
  return {
    pathname: dir,
    [Symbol.asyncDispose]: async () => {
      await rm(dir, { recursive: true, force: true });
    },
  };
}

test("isUiSourceFile excludes tests, stories and stylesheets", () => {
  expect(isUiSourceFile("frontend/src/App.tsx")).toBe(true);
  expect(isUiSourceFile("frontend/src/App.test.tsx")).toBe(false);
  expect(isUiSourceFile("frontend/src/screens.stories.tsx")).toBe(false);
  expect(isUiSourceFile("frontend/src/stories/app.data.tsx")).toBe(false);
  expect(isUiSourceFile("frontend/src/stories/window-frame.tsx")).toBe(false);
  expect(isUiSourceFile("frontend/src/style.css")).toBe(false);
  expect(isUiSourceFile("frontend/src/bridge.ts")).toBe(true);
});

test("browser dialogs are detected in every documented call form", () => {
  expect(findBrowserDialogs(`alert("hi");`)).toEqual([
    { name: "alert", index: 0 },
  ]);
  expect(findBrowserDialogs(`window.confirm("sure?");`)).toEqual([
    { name: "confirm", index: 0 },
  ]);
  expect(findBrowserDialogs(`window.prompt();`)).toEqual([
    { name: "prompt", index: 0 },
  ]);
  // Named declarations and member calls are not browser dialogs.
  expect(findBrowserDialogs(`function confirm(msg) {}`)).toEqual([]);
  expect(findBrowserDialogs(`obj.confirm()`)).toEqual([]);
});

test("raw colors are detected only outside style.css", () => {
  expect(findRawColors(`background: #f7f5ef;`)).toEqual([
    { color: "#f7f5ef", index: 12 },
  ]);
  expect(findRawColors(`color: var(--accent);`)).toEqual([]);
});

test("header rule ignores WindowHeader itself", () => {
  expect(
    findHeaderViolations(
      `<h1 className="window-header-title">t</h1>`,
      "frontend/src/shared/WindowHeader.tsx",
    ),
  ).toEqual([]);
  expect(
    findHeaderViolations(`<h1>Título</h1>`, "frontend/src/features/x/Y.tsx"),
  ).toEqual([{ index: 0 }]);
});

test("collectViolations reports all three rules with line numbers", () => {
  const sources = [
    src("a.tsx", `const x = 1;\nalert("x");\ncolor: #fff;`),
    src("b.tsx", `<h1>titulo</h1>`),
  ];
  const violations = collectViolations(sources);
  expect(violations.map((v) => v.rule)).toEqual([
    "browser-dialog",
    "raw-color",
    "header-pattern",
  ]);
  expect(violations[0].line).toBe(2);
  expect(violations[0].file).toBe("a.tsx");
});

test("describeViolation formats the baseline entry", () => {
  expect(
    describeViolation({
      file: "a.tsx",
      line: 2,
      rule: "browser-dialog",
      message: "alert() is not allowed",
    }),
  ).toBe("a.tsx:2 [browser-dialog] alert() is not allowed");
});

test("pruneBaseline removes stale entries and never adds new ones", () => {
  expect(pruneBaseline(["keep", "new"], ["keep", "stale"])).toEqual(["keep"]);
  expect(pruneBaseline([], ["anything"])).toEqual([]);
});

test("uncoveredComponents requires a same-basename test or an exception", () => {
  const files = [
    "frontend/src/App.tsx",
    "frontend/src/App.test.tsx",
    "frontend/src/main.tsx",
    "frontend/src/shared/WindowHeader.tsx",
    "frontend/src/screens.stories.tsx",
    "frontend/src/style.css",
  ];
  expect(uncoveredComponents(files, EMPTY_BASELINE)).toEqual([
    "frontend/src/shared/WindowHeader.tsx",
  ]);
  expect(
    uncoveredComponents(files, {
      allowed: [],
      uncovered: [
        { file: "frontend/src/shared/WindowHeader.tsx", reason: "legacy" },
      ],
    }),
  ).toEqual([]);
});

test("uncoveredComponents never flags stories files or helpers", () => {
  const files = [
    "frontend/src/screens.stories.tsx",
    "frontend/src/stories/app.data.tsx",
    "frontend/src/stories/window-frame.tsx",
  ];
  expect(uncoveredComponents(files, EMPTY_BASELINE)).toEqual([]);
});

test("baselineGrowth reports new allowed and uncovered entries", () => {
  const base = {
    allowed: ["a.tsx:1 [browser-dialog] alert"],
    uncovered: [{ file: "b.tsx", reason: "legacy" }],
  };
  const current = {
    allowed: ["a.tsx:1 [browser-dialog] alert", "c.tsx:2 [raw-color] #fff"],
    uncovered: [
      { file: "b.tsx", reason: "legacy" },
      { file: "d.tsx", reason: "new" },
    ],
  };
  expect(baselineGrowth(current, base)).toEqual({
    allowed: ["c.tsx:2 [raw-color] #fff"],
    uncovered: ["d.tsx"],
  });
  expect(baselineGrowth(base, base)).toEqual({ allowed: [], uncovered: [] });
});

test("bootstrapProblems rejects non-empty allowed and missing reasons", () => {
  expect(bootstrapProblems({ allowed: [], uncovered: [] })).toEqual([]);
  expect(
    bootstrapProblems({
      allowed: ["x.tsx:1 [raw-color] #fff"],
      uncovered: [],
    }).length,
  ).toBe(1);
  expect(
    bootstrapProblems({
      allowed: [],
      uncovered: [{ file: "y.tsx", reason: "" }],
    }).length,
  ).toBe(1);
  expect(
    bootstrapProblems({
      allowed: [],
      uncovered: [{ file: "y.tsx", reason: "justified legacy" }],
    }),
  ).toEqual([]);
});

test("git helpers: merge-base gate over temporary repositories", async () => {
  await using tmp = await mkdtempScratch();
  const run = async (...args: string[]) => {
    const r = await runGit(args, tmp.pathname);
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };

  await run("init", "--initial-branch=main", ".");
  await run("config", "user.email", "t@t");
  await run("config", "user.name", "t");

  // Base commit: baseline with one allowed entry, one component with test.
  await mkdir(join(tmp.pathname, "scripts"), { recursive: true });
  await mkdir(join(tmp.pathname, "frontend/src"), { recursive: true });
  await writeFile(
    join(tmp.pathname, "scripts/ui-baseline.json"),
    JSON.stringify({
      allowed: ["old.tsx:1 [raw-color] #fff"],
      uncovered: [{ file: "frontend/src/Old.tsx", reason: "legacy" }],
    }),
  );
  await writeFile(join(tmp.pathname, "frontend/src/App.tsx"), "alert? no");
  await writeFile(join(tmp.pathname, "frontend/src/App.test.tsx"), "");
  await run("add", "-A");
  await run("commit", "-m", "base");
  const base = await run("rev-parse", "HEAD");

  // Same content on a branch: no growth, gate passes.
  await run("checkout", "-b", "feature");
  let commit = await run("rev-parse", "HEAD");
  expect(await baselineAtCommit(commit, tmp.pathname)).toEqual({
    allowed: ["old.tsx:1 [raw-color] #fff"],
    uncovered: [{ file: "frontend/src/Old.tsx", reason: "legacy" }],
  });
  expect(
    baselineGrowth(
      await baselineAtCommit(commit, tmp.pathname)!,
      (await baselineAtCommit(base, tmp.pathname))!,
    ),
  ).toEqual({ allowed: [], uncovered: [] });

  // Growth on a new allowed entry fails the gate.
  const grown = {
    allowed: ["old.tsx:1 [raw-color] #fff", "new.tsx:2 [raw-color] #abc"],
    uncovered: [{ file: "frontend/src/Old.tsx", reason: "legacy" }],
  };
  await writeFile(
    join(tmp.pathname, "scripts/ui-baseline.json"),
    JSON.stringify(grown),
  );
  await run("add", "-A");
  await run("commit", "-m", "grow allowed");
  commit = await run("rev-parse", "HEAD");
  expect(
    baselineGrowth(
      await baselineAtCommit(commit, tmp.pathname)!,
      (await baselineAtCommit(base, tmp.pathname))!,
    ),
  ).toEqual({ allowed: ["new.tsx:2 [raw-color] #abc"], uncovered: [] });

  // Removal (prune) of a stale entry is not growth.
  const pruned = {
    allowed: ["old.tsx:1 [raw-color] #fff"],
    uncovered: [],
  };
  expect(
    baselineGrowth(pruned, (await baselineAtCommit(base, tmp.pathname))!),
  ).toEqual({ allowed: [], uncovered: [] });

  // Invalid ref resolves to failure (resolveBaseRef throws, fail closed).
  let invalid: unknown;
  try {
    await resolveBaseRef("does-not-exist", tmp.pathname);
  } catch (e) {
    invalid = e;
  }
  expect(invalid).toBeInstanceOf(Error);
  expect((invalid as Error).message).toContain("referência base inválida");
});

test("bootstrap gate over a temporary repository without base baseline", async () => {
  await using tmp = await mkdtempScratch();
  const run = async (...args: string[]) => {
    const r = await runGit(args, tmp.pathname);
    if (r.code !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };

  await run("init", "--initial-branch=main", ".");
  await run("config", "user.email", "t@t");
  await run("config", "user.name", "t");
  await run("commit", "--allow-empty", "-m", "root");

  // No baseline at base -> bootstrap path: audited initial set passes,
  // unaudited (allowed non-empty or missing reason) fails closed.
  expect(
    bootstrapProblems({
      allowed: [],
      uncovered: [{ file: "a.tsx", reason: "legacy reason" }],
    }),
  ).toEqual([]);
  expect(
    bootstrapProblems({
      allowed: ["a.tsx:1 [raw-color] #fff"],
      uncovered: [],
    }).length,
  ).toBeGreaterThan(0);
});
