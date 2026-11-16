// Opens the Claude Account Switcher dropdown with a single left or right click.
//
// The AppIndicator extension only sends Activate to an app on a double click
// and keeps single clicks for its own host menu, so the app's React dropdown
// could not open on a single click. This extension finds the app's icon in the
// panel and answers its single left/right clicks with Activate.
//
// It also places the dropdown. The app asks for a position, but a Wayland
// compositor ignores that for client windows, so the dropdown opened wherever
// the compositor liked. This runs inside the compositor and can move the window
// itself: it puts the dropdown under the icon, right edge aligned.
//
// Everything else (middle click, scroll, other icons) is left to the
// AppIndicator extension.
//
// The shell only imports an extension when it starts, so changes here reach the
// session after logging out and back in.

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {
  anchorPoint,
  isMenuTitle,
  isSwitcherIndicator,
  menuPlacement,
  menuWindowIndex,
  opensMenu,
  pidFromBusName,
} from "./tray.js";

// The AppIndicator extension adds icons asynchronously and replaces them when
// the app restarts; the panel has no signal for it, so it is rescanned.
const SCAN_SECONDS = 2;

// The app needs a moment to map the dropdown, so the move is retried; a move
// that arrives before the compositor places the window is simply redone.
const PLACE_DELAY_MS = 60;
const PLACE_ATTEMPTS = 8;

// A mismatch here is silent: the extension looks enabled while no icon is ever
// hooked, and log() from a session extension does not reach journalctl on every
// host. The last actions are kept in a small file so that can be diagnosed.
const PROBE = "/tmp/claude-switcher-tray.log";
const PROBE_LINES = 40;
let probeLines = [];

function probe(message) {
  try {
    probeLines.push(message);
    if (probeLines.length > PROBE_LINES)
      probeLines = probeLines.slice(-PROBE_LINES);
    GLib.file_set_contents(PROBE, `${probeLines.join("\n")}\n`);
  } catch (e) {
    logError(e);
  }
}

export default class SwitcherTrayExtension extends Extension {
  enable() {
    this._hooks = new Map();
    this._placeSource = 0;
    probeLines = [];
    probe(`enabled ${this.uuid}`);
    this._scan();
    this._timer = GLib.timeout_add_seconds(
      GLib.PRIORITY_LOW,
      SCAN_SECONDS,
      () => {
        this._scan();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  disable() {
    if (this._timer) {
      GLib.source_remove(this._timer);
      this._timer = 0;
    }
    if (this._placeSource) {
      GLib.source_remove(this._placeSource);
      this._placeSource = 0;
    }
    for (const [icon, ids] of this._hooks) {
      for (const id of ids) icon.disconnect(id);
    }
    this._hooks.clear();
  }

  _scan() {
    for (const icon of Object.values(Main.panel.statusArea)) {
      if (
        !icon ||
        this._hooks.has(icon) ||
        !isSwitcherIndicator(icon._indicator)
      )
        continue;
      const press = icon.connect("button-press-event", (actor, event) =>
        this._onPress(actor, event),
      );
      const destroy = icon.connect("destroy", () => this._hooks.delete(icon));
      this._hooks.set(icon, [press, destroy]);
      probe(
        `hooked ${icon._indicator.id} pid=${pidFromBusName(icon._indicator.busName)}`,
      );
    }
  }

  // Runs before the AppIndicator extension's own handler, which it stops.
  _onPress(icon, event) {
    const indicator = icon._indicator;
    if (!opensMenu(event.get_button()) || !isSwitcherIndicator(indicator))
      return Clutter.EVENT_PROPAGATE;
    const [x, y] = icon.get_transformed_position();
    const [width, height] = icon.get_transformed_size();
    const rect = { x, y, width, height };
    probe(
      `press button=${event.get_button()} icon=${x},${y} ${width}x${height}`,
    );
    const point = anchorPoint(rect);
    Promise.resolve(indicator.open(point.x, point.y, event.get_time())).catch(
      logError,
    );
    this._placeUnderIcon(rect, indicator);
    return Clutter.EVENT_STOP;
  }

  _placeUnderIcon(rect, indicator) {
    if (this._placeSource) {
      GLib.source_remove(this._placeSource);
      this._placeSource = 0;
    }
    let attempts = 0;
    this._placeSource = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      PLACE_DELAY_MS,
      () => {
        const win = this._menuWindow(indicator);
        if (win) this._moveUnderIcon(win, rect);
        else if (attempts + 1 === PLACE_ATTEMPTS)
          probe(
            `no dropdown window for pid ${pidFromBusName(indicator.busName)}`,
          );
        attempts += 1;
        if (attempts < PLACE_ATTEMPTS) return GLib.SOURCE_CONTINUE;
        this._placeSource = 0;
        return GLib.SOURCE_REMOVE;
      },
    );
  }

  // An exact title would identify the dropdown, but Wails skips
  // gtk_window_set_title for frameless windows, so every window of the app
  // shares one. The process id from the StatusNotifierItem bus name narrows the
  // search to the app, and the dropdown is its smallest mapped window: the
  // panel and the resume prompt are larger.
  _menuWindow(indicator) {
    const windows = [];
    for (const actor of global.get_window_actors()) {
      const win = actor.meta_window;
      if (!win) continue;
      if (isMenuTitle(win.get_title())) return win;
      windows.push(win);
    }
    const pid = pidFromBusName(indicator.busName);
    if (!pid) return null;
    const own = windows.filter((win) => win.get_pid() === pid);
    if (!own.length) return null;
    const index = menuWindowIndex(own.map((win) => win.get_frame_rect()));
    return index >= 0 ? own[index] : null;
  }

  _moveUnderIcon(win, icon) {
    // move_frame is how the shell moves another client's window; a compositor
    // build without it leaves the dropdown where it is.
    if (typeof win.move_frame !== "function") return;
    const frame = win.get_frame_rect();
    const monitor =
      Main.layoutManager.monitors.find(
        (m) =>
          icon.x >= m.x &&
          icon.x < m.x + m.width &&
          icon.y >= m.y &&
          icon.y < m.y + m.height,
      ) ?? Main.layoutManager.primaryMonitor;
    const target = menuPlacement(
      icon,
      { width: frame.width, height: frame.height },
      monitor,
    );
    if (frame.x === target.x && frame.y === target.y) return;
    probe(
      `place ${frame.width}x${frame.height} ${frame.x},${frame.y} -> ${target.x},${target.y} monitor=${monitor.x},${monitor.y} ${monitor.width}x${monitor.height}`,
    );
    win.move_frame(true, target.x, target.y);
  }
}
