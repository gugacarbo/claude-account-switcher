import type { CSSProperties, ReactNode } from "react";
import { BackIcon, CloseIcon } from "./Icons";
import type { T } from "./i18n";

interface WindowHeaderProps {
  title: string;
  t: T;
  onClose: () => void;
  onBack?: () => void;
  children?: ReactNode;
}

// Inline (not stylesheet) so the Wails drag check -- computed via
// getComputedStyle -- sees the custom property even without app CSS.
const dragStyle = { "--wails-draggable": "drag" } as CSSProperties;

export function WindowHeader({
  title,
  t,
  onClose,
  onBack,
  children,
}: WindowHeaderProps) {
  return (
    <header className="window-header">
      <div
        className="window-header-bar"
        data-testid="window-drag"
        style={dragStyle}
      >
        <h1 className="window-header-title">{title}</h1>
      </div>
      <div className="window-header-actions">
        {onBack ? (
          <button
            type="button"
            className="window-header-button"
            aria-label={t("Back", "返回")}
            onClick={onBack}
          >
            <BackIcon />
          </button>
        ) : null}
        <button
          type="button"
          className="window-header-button"
          aria-label={t("Close", "关闭")}
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>
      {children}
    </header>
  );
}
