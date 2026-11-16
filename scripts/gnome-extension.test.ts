import { describe, expect, test } from "bun:test";
import {
  anchorPoint,
  isMenuTitle,
  isSwitcherIndicator,
  menuPlacement,
  menuWindowIndex,
  opensMenu,
  pidFromBusName,
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

  // The app asks for a position, but a Wayland compositor ignores it for
  // client windows; the shell moves the window instead, so it has to recognise
  // the dropdown and nothing else.
  test("recognises the dropdown window by its title", () => {
    expect(isMenuTitle("Claude Account Switcher menu")).toBe(true);
    expect(isMenuTitle("Claude 账号切换器 menu")).toBe(true);
    expect(isMenuTitle("Claude Account Switcher")).toBe(false);
    expect(isMenuTitle("Some other app menu")).toBe(false);
    expect(isMenuTitle(undefined)).toBe(false);
  });

  test("places the dropdown under the icon with matching right edges", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const icon = { x: 1870, y: 0, width: 20, height: 32 };
    expect(menuPlacement(icon, { width: 320, height: 440 }, monitor)).toEqual({
      x: 1570,
      y: 38,
    });
  });

  test("keeps the dropdown inside the monitor on the left edge", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const icon = { x: 0, y: 0, width: 20, height: 32 };
    expect(menuPlacement(icon, { width: 320, height: 440 }, monitor)).toEqual({
      x: 6,
      y: 38,
    });
  });

  test("flips above the icon when there is no room below", () => {
    const monitor = { x: 0, y: 0, width: 1920, height: 1080 };
    const icon = { x: 1870, y: 1000, width: 20, height: 40 };
    expect(menuPlacement(icon, { width: 320, height: 440 }, monitor)).toEqual({
      x: 1570,
      y: 554,
    });
  });

  test("follows the monitor the icon is on", () => {
    const right = { x: 1920, y: 0, width: 1920, height: 1080 };
    const icon = { x: 3800, y: 0, width: 20, height: 32 };
    expect(menuPlacement(icon, { width: 320, height: 440 }, right)).toEqual({
      x: 3500,
      y: 38,
    });
  });

  // The title never reaches the window (Wails skips it for frameless windows),
  // so the dropdown is identified by the indicator's process and by size.
  test("reads the client pid from the indicator bus name", () => {
    expect(pidFromBusName("org.kde.StatusNotifierItem-64583-1")).toBe(64583);
    expect(pidFromBusName("org.kde.StatusNotifierItem-1-12")).toBe(1);
    expect(pidFromBusName("org.kde.StatusNotifierItem-")).toBe(0);
    expect(pidFromBusName("com.example.Other")).toBe(0);
    expect(pidFromBusName(undefined)).toBe(0);
  });

  test("picks the smallest window of the app as the dropdown", () => {
    const panel = { width: 420, height: 640 };
    const resume = { width: 480, height: 540 };
    const menu = { width: 320, height: 440 };
    expect(menuWindowIndex([panel, menu, resume])).toBe(1);
    expect(menuWindowIndex([resume, menu])).toBe(1);
    expect(menuWindowIndex([panel])).toBe(0);
    expect(menuWindowIndex([])).toBe(-1);
  });
});
