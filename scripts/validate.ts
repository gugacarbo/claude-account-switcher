const profiles: Record<string, string[][]> = {
  fast: [
    ["bun", "run", "lint"],
    ["bun", "run", "typecheck"],
    ["go", "vet", "-tags", "headless", "./..."],
  ],
  local: [
    ["bun", "run", "validate:fast"],
    ["bun", "run", "test:ui"],
    ["bun", "run", "test:go"],
    ["bun", "run", "build:ui"],
    ["bun", "run", "knip"],
    ["bun", "run", "test:tools"],
    ["bun", "run", "check:architecture"],
    ["bun", "run", "check:contract"],
    ["bun", "run", "spellcheck"],
  ],
  ci: [
    ["bun", "run", "validate"],
    ["bun", "run", "test:race"],
    ["bun", "run", "lint:go"],
    ["bun", "run", "secrets:check"],
    ["bun", "run", "security:go"],
  ],
};
const name = process.argv[2] ?? "local";
const commands = profiles[name];
if (!commands) throw new Error(`Unknown validation profile: ${name}`);
for (const cmd of commands) {
  console.log(`> ${cmd.join(" ")}`);
  const child = Bun.spawn(cmd, { stdout: "inherit", stderr: "inherit" });
  const code = await child.exited;
  if (code !== 0) process.exit(code);
}
