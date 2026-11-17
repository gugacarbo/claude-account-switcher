import type { Decorator } from "@storybook/react-vite";

// Render stories inside the same dimensions as their native Wails windows.
// The preview itself may be any size; the application container must not grow
// with it, otherwise stories hide compact-layout and overflow problems.
function windowFrame(width: number, height?: number): Decorator {
  return (Story) => (
    <div
      style={{
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        minHeight: "100vh",
        padding: 16,
      }}
    >
      <div
        style={{
          width,
          maxWidth: "100%",
          height,
          overflow: "auto",
          boxSizing: "border-box",
          border: "1px solid var(--line)",
          borderRadius: 12,
          background: "var(--bg)",
        }}
      >
        <Story />
      </div>
    </div>
  );
}

export const panelFrame = windowFrame(420, 640);
export const resumeFrame = windowFrame(480);
export const trayFrame = windowFrame(340);
