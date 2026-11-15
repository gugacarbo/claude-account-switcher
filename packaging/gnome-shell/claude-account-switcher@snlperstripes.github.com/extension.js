// Opens the Claude Account Switcher dropdown with a single left or right click.
//
// The AppIndicator extension only sends Activate to an app on a double click
// and keeps single clicks for its own host menu, so the app's React dropdown
// could not open on a single click. This extension finds the app's icon in the
// panel and answers its single left/right clicks with Activate, passing the
// icon's position so the dropdown is anchored under it. Everything else
// (middle click, scroll, other icons) is left to the AppIndicator extension.

import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { anchorPoint, isSwitcherIndicator, opensMenu } from "./tray.js";

// The AppIndicator extension adds icons asynchronously and replaces them when
// the app restarts; the panel has no signal for it, so it is rescanned.
const SCAN_SECONDS = 2;

export default class SwitcherTrayExtension extends Extension {
  enable() {
    this._hooks = new Map();
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
    }
  }

  // Runs before the AppIndicator extension's own handler, which it stops.
  _onPress(icon, event) {
    const indicator = icon._indicator;
    if (!opensMenu(event.get_button()) || !isSwitcherIndicator(indicator)) {
      return Clutter.EVENT_PROPAGATE;
    }
    const [x, y] = icon.get_transformed_position();
    const [width, height] = icon.get_transformed_size();
    const point = anchorPoint({ x, y, width, height });
    Promise.resolve(indicator.open(point.x, point.y, event.get_time())).catch(
      logError,
    );
    return Clutter.EVENT_STOP;
  }
}
