const vite = Bun.spawn(
  ["bun", "run", "--filter", "claude-account-switcher-ui", "dev"],
  { stdout: "inherit", stderr: "inherit" },
);
const desktop = Bun.spawn(["go", "run", "-tags", "purego", "."], {
  env: { ...process.env, FRONTEND_DEVSERVER_URL: "http://127.0.0.1:5173" },
  stdout: "inherit",
  stderr: "inherit",
});
const stop = () => {
  vite.kill();
  desktop.kill();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const code = await Promise.race([vite.exited, desktop.exited]);
stop();
process.exit(code);
