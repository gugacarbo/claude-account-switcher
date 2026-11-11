import { describe, it, expect } from "vitest";
import { desktopBridge } from "./bridge";
describe("desktop bridge", () => {
  it("reports a missing desktop runtime instead of returning sample data", async () => {
    await expect(desktopBridge.state()).rejects.toThrow(
      "Desktop connection unavailable",
    );
  });
});
