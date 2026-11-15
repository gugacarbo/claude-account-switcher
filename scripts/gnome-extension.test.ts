import { describe, expect, test } from "bun:test";
import {
  anchorPoint,
  isSwitcherIndicator,
  opensMenu,
} from "../packaging/gnome-shell/claude-account-switcher@snlperstripes.github.com/tray.js";

describe("GNOME Shell tray extension", () => {
  test("recognises the app's icon in both UI languages", () => {
    const open = () => Promise.resolve();
    expect(isSwitcherIndicator({ id: "Claude Account Switcher", open })).toBe(
      true,
    );
    expect(isSwitcherIndicator({ id: "Claude 账号切换器", open })).toBe(true);
  });

  test("leaves other icons and incomplete indicators alone", () => {
    const open = () => Promise.resolve();
    expect(isSwitcherIndicator({ id: "Wails", open })).toBe(false);
    expect(isSwitcherIndicator({ id: "Claude Account Switcher" })).toBe(false);
    expect(isSwitcherIndicator(undefined)).toBe(false);
  });

  test("opens on left and right clicks only", () => {
    expect(opensMenu(1)).toBe(true);
    expect(opensMenu(3)).toBe(true);
    expect(opensMenu(2)).toBe(false);
  });

  test("anchors under the centre of the icon", () => {
    expect(anchorPoint({ x: 1390, y: 0, width: 21, height: 32 })).toEqual({
      x: 1401,
      y: 32,
    });
  });
});
