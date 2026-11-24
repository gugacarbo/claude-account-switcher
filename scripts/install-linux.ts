#!/usr/bin/env bun
/**
 * Install the switcher as the user's main Linux installation.
 *
 * Usage:
 *   bun scripts/install-linux.ts   (or: make install)
 *
 * Builds the production binary (frontend embedded) and installs it to
 * ~/.local/bin/claude-switcher, plus the app-menu launcher and icon. If the
 * XDG autostart entry already exists, its Exec is rewritten to the installed
 * path — the entry is never created here, so the script does not enable
 * autostart behind the user's back (the app's own toggle owns that choice).
 *
 * On GNOME Shell it also compares the installed tray extension with the one in
 * packaging/gnome-shell and reinstalls it (`make install-gnome-extension`)
 * when they differ. The shell only loads the new copy after logout/login.
 */

import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";

const BINARY_NAME = "claude-switcher";
const DESKTOP_NAME = "claude-account-switcher.desktop";
const ICON_NAME = "claude-account-switcher.svg";
const GNOME_EXTENSION = "claude-account-switcher@snlperstripes.github.com";

// desktopExecQuote mirrors desktopExecQuote in internal/app/platform_linux.go
// so entries written here read exactly like the ones the app writes: Exec
// quoting escapes \ " ` $ and % (field codes), then the .desktop layer doubles
// every backslash once more.
export function desktopExecQuote(path: string): string {
  const arg = `"${path
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("`", "\\`")
    .replaceAll("$", "\\$")
    .replaceAll("%", "%%")}"`;
  return arg.replaceAll("\\", "\\\\");
}

// autostartEntry is byte-for-byte the format of setAutostart in
// internal/app/platform_linux.go, with the installed executable path.
export function autostartEntry(exe: string): string {
  return (
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Claude Account Switcher\n" +
    "Comment=Switch the Claude desktop app between accounts\n" +
    `Exec=${desktopExecQuote(exe)}\n` +
    "Terminal=false\n" +
    "X-GNOME-Autostart-enabled=true\n"
  );
}

export function launcherEntry(exe: string): string {
  return (
    "[Desktop Entry]\n" +
    "Type=Application\n" +
    "Name=Claude Account Switcher\n" +
    "Comment=Switch the Claude desktop app between accounts\n" +
    `Exec=${desktopExecQuote(exe)}\n` +
    "Icon=claude-account-switcher\n" +
    "Terminal=false\n" +
    "Categories=Utility;\n"
  );
}

// autostartAction keeps the user's choice: an existing entry is repointed to
// the installed binary (a dev run may have recorded a /tmp/go-build path that
// vanishes on reboot); a missing entry stays missing.
export function autostartAction(exists: boolean): "rewrite" | "skip" {
  return exists ? "rewrite" : "skip";
}

// extensionAction says whether the installed extension (null when missing)
// matches the packaged one, file by file.
export function extensionAction(
  packaged: Map<string, string>,
  installed: Map<string, string> | null,
): "install" | "current" {
  if (!installed) return "install";
  for (const [name, content] of packaged) {
    if (installed.get(name) !== content) return "install";
  }
  return "current";
}

// readFiles reads the regular files of dir, or returns null if it is missing.
async function readFiles(dir: string): Promise<Map<string, string> | null> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => null);
  if (!entries) return null;
  const files = new Map<string, string>();
  for (const e of entries) {
    if (e.isFile())
      files.set(e.name, await readFile(join(dir, e.name), "utf8"));
  }
  return files;
}

// installGnomeExtension brings the tray extension up to date when GNOME
// Shell is there. Returns whether it installed a new copy.
async function installGnomeExtension(
  root: string,
  home: string,
): Promise<boolean> {
  if (!Bun.which("gnome-extensions")) {
    console.log("install-linux: GNOME Shell não encontrado; extensão ignorada");
    return false;
  }
  const packaged = await readFiles(
    join(root, "packaging", "gnome-shell", GNOME_EXTENSION),
  );
  if (!packaged) {
    console.error(
      "install-linux: extensão não encontrada em packaging/gnome-shell",
    );
    return false;
  }
  const installed = await readFiles(
    join(home, ".local/share/gnome-shell/extensions", GNOME_EXTENSION),
  );
  if (extensionAction(packaged, installed) === "current") {
    console.log("install-linux: extensão GNOME já está atualizada");
    return false;
  }
  const make = Bun.spawnSync(["make", "install-gnome-extension"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (make.exitCode !== 0) {
    console.error("install-linux: a extensão GNOME não foi instalada");
    return false;
  }
  console.log("install-linux: extensão GNOME atualizada");
  return true;
}

async function exists(path: string): Promise<boolean> {
  return Boolean(await stat(path).catch(() => null));
}

export async function main(): Promise<number> {
  if (process.platform !== "linux") {
    console.error("install-linux: este script é apenas para Linux");
    return 1;
  }
  const home = process.env.HOME;
  if (!home) {
    console.error("install-linux: HOME não definido");
    return 1;
  }
  const root = resolve(import.meta.dir, "..");
  const exe = join(home, ".local", "bin", BINARY_NAME);

  const build = Bun.spawnSync(["bun", "run", "build"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (build.exitCode !== 0) {
    console.error("install-linux: o build falhou; nada foi instalado");
    return build.exitCode ?? 1;
  }
  const built = join(root, "dist", "claude-account-switcher");

  // Keep the previous binary recoverable (dist/ is gitignored).
  if (await exists(exe)) {
    await copyFile(exe, join(root, "dist", `${BINARY_NAME}.previous`));
  }
  await mkdir(join(home, ".local", "bin"), { recursive: true });
  await copyFile(built, exe);
  await chmod(exe, 0o755);
  console.log(`install-linux: binário em ${exe}`);

  const iconDir = join(home, ".local/share/icons/hicolor/scalable/apps");
  await mkdir(iconDir, { recursive: true });
  await copyFile(join(root, "assets", "mark.svg"), join(iconDir, ICON_NAME));

  const appsDir = join(home, ".local/share/applications");
  await mkdir(appsDir, { recursive: true });
  await writeFile(join(appsDir, DESKTOP_NAME), launcherEntry(exe), "utf8");
  console.log(`install-linux: launcher em ${join(appsDir, DESKTOP_NAME)}`);

  const autostart = join(home, ".config", "autostart", DESKTOP_NAME);
  if (autostartAction(await exists(autostart)) === "rewrite") {
    await writeFile(autostart, autostartEntry(exe), "utf8");
    console.log(`install-linux: autostart reapontado para ${exe}`);
  } else {
    console.log(
      "install-linux: autostart não existe; deixe como está (o toggle do app decide)",
    );
  }

  Bun.spawnSync(["update-desktop-database", appsDir], {
    stdout: "ignore",
    stderr: "ignore",
  });

  const extensionUpdated = await installGnomeExtension(root, home);

  console.log(
    [
      "",
      "Pronto. Próximos passos:",
      "  • pare o `bun run dev` e abra o app pelo menu ou pelo binário instalado;",
      ...(extensionUpdated
        ? [
            "  • extensão GNOME atualizada: faça logout/login — o shell só carrega",
            "    a nova versão numa sessão nova;",
          ]
        : []),
      "  • gerencie o autostart pelo app INSTALADO: o app dev grava o caminho",
      "    temporário do `go run` (/tmp) quando o toggle é usado nele.",
    ].join("\n"),
  );
  return 0;
}

// Main guard: importing this module (e.g. from bun test scripts/) must not
// build or install anything.
if (import.meta.main) {
  process.exit(await main());
}
