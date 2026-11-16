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
