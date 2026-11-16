// Pure helpers for the GNOME Shell extension, kept free of Shell imports so
// they can be unit tested outside the Shell.

// SNI Ids the app publishes: its name in each UI language (see appName in
// internal/app/tray.go; a Go test keeps both lists in sync).
export const TRAY_IDS = new Set([
  "Claude Account Switcher",
  "Claude 账号切换器",
]);

const PRIMARY_BUTTON = 1;
const SECONDARY_BUTTON = 3;

// isSwitcherIndicator reports whether an AppIndicator extension indicator is
// the app's icon and can be activated.
export function isSwitcherIndicator(indicator) {
  return (
    Boolean(indicator) &&
    TRAY_IDS.has(indicator.id) &&
    typeof indicator.open === "function"
  );
}

// opensMenu reports whether a mouse button opens the React dropdown. The
// middle button keeps the host behaviour (SecondaryActivate).
export function opensMenu(button) {
  return button === PRIMARY_BUTTON || button === SECONDARY_BUTTON;
}

// anchorPoint is the point sent with Activate: the bottom centre of the icon,
// so the app places the dropdown right under it.
export function anchorPoint(rect) {
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height),
  };
}

// MENU_TITLE_SUFFIX is the title the app would like its dropdown to carry (see
// windowOptions in internal/app/desktop_runtime.go; a Go test keeps the two in
// sync). Wails 3.1.0 skips gtk_window_set_title for frameless windows, so the
// window never actually receives it: the extension falls back to the process id
// below. Keeping the check costs nothing and starts matching by itself if Wails
// fixes that.
export const MENU_TITLE_SUFFIX = " menu";

// isMenuTitle reports whether a window title belongs to the tray dropdown.
export function isMenuTitle(title) {
  if (typeof title !== "string" || !title.endsWith(MENU_TITLE_SUFFIX))
    return false;
  return TRAY_IDS.has(title.slice(0, -MENU_TITLE_SUFFIX.length));
}

// pidFromBusName reads the owning process from a StatusNotifierItem bus name,
// which follows org.kde.StatusNotifierItem-<pid>-<n>. Wails window titles are
// not usable here: it skips gtk_window_set_title for frameless windows, so
// every window of the app keeps the same title.
export function pidFromBusName(busName) {
  if (typeof busName !== "string") return 0;
  const match = /^org\.kde\.StatusNotifierItem-(\d+)-/.exec(busName);
  return match ? Number(match[1]) : 0;
}

// menuWindowIndex picks the dropdown among the windows of one process: the
// panel and the resume prompt are larger, so the smallest mapped window is the
// dropdown.
export function menuWindowIndex(sizes) {
  let best = -1;
  let bestArea = Infinity;
  sizes.forEach(({ width, height }, index) => {
    const area = width * height;
    if (area < bestArea) {
      bestArea = area;
      best = index;
    }
  });
  return best;
}

// menuPlacement puts a dropdown of `size` under a tray icon: right edge aligned
// with the icon, clamped into `monitor`, and flipped above the icon when the
// space below is too small.
export function menuPlacement(icon, size, monitor, margin = 6) {
  const clampX = (value) =>
    Math.max(
      monitor.x + margin,
      Math.min(value, monitor.x + monitor.width - size.width - margin),
    );
  const x = Math.round(clampX(icon.x + icon.width - size.width));
  let y = Math.round(icon.y + icon.height + margin);
  if (y + size.height > monitor.y + monitor.height - margin)
    y = Math.round(Math.max(monitor.y + margin, icon.y - size.height - margin));
  return { x, y };
}
