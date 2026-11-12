import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { desktopBridge } from "./bridge";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App
      bridge={desktopBridge}
      view={new URLSearchParams(location.search).get("view") ?? "panel"}
    />
  </StrictMode>,
);
