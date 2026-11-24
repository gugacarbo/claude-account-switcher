import { describe, expect, test } from "bun:test";
import {
  autostartAction,
  autostartEntry,
  desktopExecQuote,
  extensionAction,
  launcherEntry,
} from "./install-linux";

describe("install-linux", () => {
  // Same rules as desktopExecQuote in internal/app/platform_linux.go: Exec
  // quoting first (\ " ` $ %), then the .desktop layer doubles backslashes.
  test("quotes a plain path like the app does", () => {
    expect(desktopExecQuote("/home/u/.local/bin/claude-switcher")).toBe(
      '"/home/u/.local/bin/claude-switcher"',
    );
  });

  test("keeps spaces inside the quotes", () => {
    expect(desktopExecQuote("/home/u/My Apps/claude-switcher")).toBe(
      '"/home/u/My Apps/claude-switcher"',
    );
  });

  test("escapes Exec specials and doubles backslashes for the desktop layer", () => {
    expect(desktopExecQuote('a"b')).toBe('"a\\\\"b"');
    expect(desktopExecQuote("a`b")).toBe('"a\\\\`b"');
    expect(desktopExecQuote("a$b")).toBe('"a\\\\$b"');
    expect(desktopExecQuote("a%b")).toBe('"a%%b"');
    expect(desktopExecQuote("a\\b")).toBe('"a\\\\\\\\b"');
    // Combined case from TestDesktopExecQuote in platform_linux_test.go.
    expect(desktopExecQuote('/a$b"c\\d')).toBe('"/a\\\\$b\\\\"c\\\\\\\\d"');
  });

  test("autostart entry matches the format the app writes", () => {
    const exe = "/home/u/.local/bin/claude-switcher";
    expect(autostartEntry(exe)).toBe(
      "[Desktop Entry]\n" +
        "Type=Application\n" +
        "Name=Claude Account Switcher\n" +
        "Comment=Switch the Claude desktop app between accounts\n" +
        `Exec="${exe}"\n` +
        "Terminal=false\n" +
        "X-GNOME-Autostart-enabled=true\n",
    );
  });

  test("launcher entry carries the icon and the installed Exec", () => {
    const entry = launcherEntry("/home/u/.local/bin/claude-switcher");
    expect(entry).toContain('Exec="/home/u/.local/bin/claude-switcher"\n');
    expect(entry).toContain("Icon=claude-account-switcher\n");
    expect(entry).toContain("Categories=Utility;\n");
  });

  // The script must not enable autostart on its own; it only repoints an
  // entry the user already has (a dev run may have recorded a /tmp path).
  test("rewrites an existing autostart entry and never creates one", () => {
    expect(autostartAction(true)).toBe("rewrite");
    expect(autostartAction(false)).toBe("skip");
  });

  test("reinstalls the GNOME extension only when a packaged file differs", () => {
    const packaged = new Map([
      ["metadata.json", "{}"],
      ["tray.js", "new"],
    ]);
    expect(extensionAction(packaged, null)).toBe("install");
    expect(extensionAction(packaged, new Map([["metadata.json", "{}"]]))).toBe(
      "install",
    );
    expect(
      extensionAction(
        packaged,
        new Map([
          ["metadata.json", "{}"],
          ["tray.js", "old"],
        ]),
      ),
    ).toBe("install");
    // gnome-extensions install may add files of its own.
    expect(
      extensionAction(
        packaged,
        new Map([...packaged, ["schemas", "compiled"]]),
      ),
    ).toBe("current");
  });
});
