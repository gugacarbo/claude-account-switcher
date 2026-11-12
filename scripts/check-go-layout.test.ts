import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";

test("Go entrypoint and implementation live outside the repository root", () => {
  expect(readdirSync(".").filter((name) => name.endsWith(".go"))).toEqual([]);
  expect(existsSync("cmd/claude-account-switcher/main.go")).toBe(true);
  expect(existsSync("internal/app/switcher.go")).toBe(true);
});
