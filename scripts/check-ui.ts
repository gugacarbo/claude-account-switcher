import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

export const BASELINE_PATH = "scripts/ui-baseline.json";
export const UI_ROOT = "frontend/src";

export interface UiSource {
  file: string;
  source: string;
}

export interface UiViolation {
  file: string;
  line: number;
  rule: string;
  message: string;
}

export interface UiBaseline {
  /** Exact violations (file:line [rule] message) inherited from legacy code. */
  allowed: string[];
  /** Production component files without a dedicated scenario test, with reason. */
  uncovered: { file: string; reason: string }[];
}

export const EMPTY_BASELINE: UiBaseline = { allowed: [], uncovered: [] };

/**
 * Scanned scope: production UI sources under frontend/src. Tests, stories and
 * the token stylesheet are excluded on purpose (see docs/ui-contract.md).
 */
export function isUiSourceFile(file: string): boolean {
  if (!/\.(tsx|ts)$/.test(file)) return false;
  if (file.endsWith(".test.tsx") || file.endsWith(".test.ts")) return false;
  if (file.endsWith(".stories.tsx")) return false;
  return true;
}

async function walkFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walkFiles(join(root, e.name)) : [join(root, e.name)],
      ),
    )
  ).flat();
}

export async function scanUiSources(root: string): Promise<UiSource[]> {
  const files = await walkFiles(root);
  return Promise.all(
    files
      .filter((file) => isUiSourceFile(relative(process.cwd(), file)))
      .map(async (file) => ({
        file: relative(process.cwd(), file),
        source: await readFile(file, "utf8"),
      })),
  );
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Browser dialogs must never appear in production UI code. */
export function findBrowserDialogs(
  source: string,
): { name: string; index: number }[] {
  return [
    ...source.matchAll(
      /(?<![\w$.])(?<!function\s)(?:window\s*\.\s*)?(alert|confirm|prompt)\s*\(/g,
    ),
  ].map((m) => ({ name: m[1], index: m.index ?? 0 }));
}

/** New hex color literals outside style.css violate the token contract. */
export function findRawColors(
  source: string,
): { color: string; index: number }[] {
  return [...source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => ({
    color: m[0],
    index: m.index ?? 0,
  }));
}

/**
 * Screens draw their title through the shared WindowHeader component; a raw
 * h1 outside it bypasses the drag region and header action pattern.
 */
export function findHeaderViolations(
  source: string,
  file: string,
): { index: number }[] {
  if (file.endsWith("WindowHeader.tsx")) return [];
  return [...source.matchAll(/<h1[\s>]/g)].map((m) => ({
    index: m.index ?? 0,
  }));
}

/**
 * Every production component needs a same-basename scenario test
 * (screen-coverage rule) or an explicit, justified exception in the baseline.
 */
export function uncoveredComponents(
  files: string[],
  baseline: UiBaseline,
): string[] {
  const exceptions = new Set(baseline.uncovered.map((u) => u.file));
  return files
    .filter(
      (file) =>
        file.endsWith(".tsx") &&
        !file.endsWith("main.tsx") &&
        !file.includes(".test.") &&
        !file.endsWith(".stories.tsx") &&
        !exceptions.has(file),
    )
    .filter((file) => !files.includes(`${file.slice(0, -4)}.test.tsx`))
    .sort();
}

// ---------------------------------------------------------------------------
// Baseline drift gate: the checked-in baseline may only shrink against the
// merge-base with a base ref (UI_BASE_REF, default origin/main). New "allowed"
// or "uncovered" entries compared to the base fail the gate (fail closed).
// ---------------------------------------------------------------------------

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export async function runGit(args: string[], cwd: string): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { code: await proc.exited, stdout, stderr };
}

/** Resolves the base ref to a commit; throws (fail closed) if invalid. */
export async function resolveBaseRef(
  ref: string,
  cwd: string,
): Promise<string> {
  const r = await runGit(
    ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
    cwd,
  );
  if (r.code !== 0 || !r.stdout.trim()) {
    throw new Error(
      `check-ui: referência base inválida: "${ref}" (defina UI_BASE_REF ou garanta que origin/main existe)`,
    );
  }
  return r.stdout.trim();
}

/** Merge-base between HEAD and the resolved base ref; throws if impossible. */
export async function mergeBaseCommit(
  baseRef: string,
  cwd: string,
): Promise<string> {
  const r = await runGit(["merge-base", "HEAD", baseRef], cwd);
  const commit = r.stdout.trim();
  if (r.code !== 0 || !commit) {
    throw new Error(
      `check-ui: merge-base entre HEAD e "${baseRef}" falhou (históricos sem ancestral comum?)`,
    );
  }
  return commit;
}

/** Baseline as of a commit; null when the file does not exist there. */
export async function baselineAtCommit(
  commit: string,
  cwd: string,
): Promise<UiBaseline | null> {
  const r = await runGit(["show", `${commit}:${BASELINE_PATH}`], cwd);
  if (r.code !== 0) return null;
  const parsed = JSON.parse(r.stdout) as Partial<UiBaseline>;
  return { allowed: parsed.allowed ?? [], uncovered: parsed.uncovered ?? [] };
}

/** Entries present in the current baseline but absent from the base one. */
export function baselineGrowth(
  current: UiBaseline,
  base: UiBaseline,
): { allowed: string[]; uncovered: string[] } {
  const baseAllowed = new Set(base.allowed);
  const baseUncovered = new Set(base.uncovered.map((u) => u.file));
  return {
    allowed: current.allowed.filter((a) => !baseAllowed.has(a)).sort(),
    uncovered: current.uncovered
      .map((u) => u.file)
      .filter((f) => !baseUncovered.has(f))
      .sort(),
  };
}

/**
 * Bootstrap audit: when no baseline exists at the base commit, the checked-in
 * one is the initial explicit set and must be fully justified: no inherited
 * "allowed" violations and every "uncovered" entry with a non-empty reason.
 */
export function bootstrapProblems(baseline: UiBaseline): string[] {
  const problems: string[] = [];
  if (baseline.allowed.length > 0) {
    problems.push(
      `check-ui: bootstrap: a baseline inicial não pode conter entradas em "allowed" (${baseline.allowed.length}); corrija as violações antes de congelar`,
    );
  }
  for (const u of baseline.uncovered) {
    if (!u.reason?.trim()) {
      problems.push(
        `check-ui: bootstrap: exceção de cobertura sem motivo auditado: ${u.file}`,
      );
    }
  }
  return problems;
}

export function collectViolations(sources: UiSource[]): UiViolation[] {
  const violations: UiViolation[] = [];
  for (const { file, source } of sources) {
    for (const { name, index } of findBrowserDialogs(source)) {
      violations.push({
        file,
        line: lineOf(source, index),
        rule: "browser-dialog",
        message: `${name}() is not allowed in UI code; use an in-app dialog per docs/ui-contract.md`,
      });
    }
    for (const { color, index } of findRawColors(source)) {
      violations.push({
        file,
        line: lineOf(source, index),
        rule: "raw-color",
        message: `literal color ${color} outside style.css; use a token (var(--…)) per docs/ui-contract.md`,
      });
    }
    for (const { index } of findHeaderViolations(source, file)) {
      violations.push({
        file,
        line: lineOf(source, index),
        rule: "header-pattern",
        message:
          "<h1> outside shared/WindowHeader.tsx; render <WindowHeader> per docs/ui-contract.md",
      });
    }
  }
  return violations.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line,
  );
}

export function describeViolation(v: UiViolation): string {
  return `${v.file}:${v.line} [${v.rule}] ${v.message}`;
}

/** Prune-only: entries no longer present in the code are dropped; nothing is added. */
export function pruneBaseline(current: string[], baseline: string[]): string[] {
  return baseline.filter((entry) => current.includes(entry)).sort();
}

async function readBaseline(): Promise<UiBaseline> {
  const raw = JSON.parse(await readFile(BASELINE_PATH, "utf8")) as UiBaseline;
  return { allowed: raw.allowed ?? [], uncovered: raw.uncovered ?? [] };
}

async function main(): Promise<number> {
  const prune = process.argv.includes("--prune-baseline");
  const files = (await walkFiles(UI_ROOT)).map((f) =>
    relative(process.cwd(), f),
  );
  const sources = await scanUiSources(UI_ROOT);
  const current = collectViolations(sources).map(describeViolation);
  const baseline = await readBaseline();

  if (prune) {
    const allowed = pruneBaseline(current, baseline.allowed);
    await writeFile(
      BASELINE_PATH,
      `${JSON.stringify({ allowed, uncovered: baseline.uncovered }, null, 2)}\n`,
    );
    console.log(
      `check-ui: baseline podada (removidas ${baseline.allowed.length - allowed.length} entradas obsoletas; nada é adicionado por este comando)`,
    );
    return 0;
  }

  // Baseline drift gate (compare against merge-base with UI_BASE_REF/origin/main).
  const baseRef = process.env.UI_BASE_REF ?? "origin/main";
  try {
    const baseCommit = await mergeBaseCommit(
      await resolveBaseRef(baseRef, process.cwd()),
      process.cwd(),
    );
    const baseBaseline = await baselineAtCommit(baseCommit, process.cwd());
    if (baseBaseline === null) {
      // Bootstrap: no baseline at base; the checked-in one is the explicit,
      // audited initial set — allowed must be empty and every uncovered entry
      // needs a reason (fail closed otherwise).
      const bootstrap = bootstrapProblems(baseline);
      for (const p of bootstrap) console.error(p);
      if (bootstrap.length > 0) {
        console.error("check-ui: falhou (bootstrap da baseline não auditado)");
        return 1;
      }
    } else {
      const growth = baselineGrowth(baseline, baseBaseline);
      for (const a of growth.allowed) {
        console.error(
          `check-ui: entrada nova em "allowed" vs ${baseRef} (merge-base ${baseCommit.slice(0, 12)}): ${a} — baseline é prune-only, não pode crescer`,
        );
      }
      for (const u of growth.uncovered) {
        console.error(
          `check-ui: entrada nova em "uncovered" vs ${baseRef} (merge-base ${baseCommit.slice(0, 12)}): ${u} — exceções de cobertura não podem crescer sem revisão da baseline no base`,
        );
      }
      if (growth.allowed.length > 0 || growth.uncovered.length > 0) {
        console.error("check-ui: falhou (baseline cresceu contra a base)");
        return 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("check-ui: falhou (referência base indisponível)");
    return 1;
  }

  let failed = false;
  for (const v of current.filter(
    (entry) => !baseline.allowed.includes(entry),
  )) {
    console.error(`check-ui: ${v}`);
    failed = true;
  }

  for (const file of uncoveredComponents(files, baseline)) {
    console.error(
      `check-ui: componente de produção ${file} sem cenário (nenhum ${file.slice(0, -4)}.test.tsx); crie o teste ou registre exceção com motivo em ${BASELINE_PATH}`,
    );
    failed = true;
  }

  if (failed) {
    console.error("check-ui: falhou (violações novas ou cobertura ausente)");
    return 1;
  }
  console.log(
    `check-ui: OK (${sources.length} arquivos; ${baseline.allowed.length} exceções de legado, ${baseline.uncovered.length} exceções de cobertura documentadas)`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await main());
}
