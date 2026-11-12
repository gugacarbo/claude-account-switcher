import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

export function violation(file: string, target: string): boolean {
  const source = file.split("/");
  const destination = target.split("/");
  const feature = source.indexOf("features");
  const other = destination.indexOf("features");
  return (
    feature >= 0 && other >= 0 && source[feature + 1] !== destination[other + 1]
  );
}
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
      ),
    )
  ).flat();
}
if (import.meta.main) {
  for (const file of await walk("frontend/src")) {
    if (!/\.tsx?$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    if (file.includes("/features/") && source.includes("window.wails"))
      throw new Error(`Native runtime belongs in bridge: ${file}`);
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      if (!match[1].startsWith(".")) continue;
      const target = relative(process.cwd(), resolve(file, "..", match[1]));
      if (violation(file, target))
        throw new Error(`Cross-feature import: ${file} -> ${target}`);
    }
  }
  console.log("Architecture boundaries OK");
}
