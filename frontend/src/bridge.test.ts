import { afterEach, describe, expect, it, vi } from "vitest";
import { desktopBridge, subscribeNavigation } from "./bridge";

afterEach(() => {
  vi.restoreAllMocks();
});

function fakeRuntimeModule() {
  let dispatch: ((event: unknown) => void) | null = null;
  const on = vi.fn((_name: string, cb: (event: unknown) => void) => {
    dispatch = cb;
    return () => {
      dispatch = null;
    };
  });
  const off = vi.fn();
  return {
    module: { Call: { ByID: vi.fn() }, Events: { On: on } },
    on,
    off,
    emit: (event: unknown) => dispatch?.(event),
  };
}

describe("desktop bridge", () => {
  it("reports a missing desktop runtime instead of returning sample data", async () => {
    await expect(desktopBridge.state()).rejects.toThrow(
      "Desktop connection unavailable",
    );
  });
});

describe("subscribeNavigation", () => {
  it("forwards the navigate section payload and stops after cancel", async () => {
    const fake = fakeRuntimeModule();
    const callback = vi.fn();
    const cancel = await subscribeNavigation(callback, async () => fake.module);
    // Registration is asynchronous; yield before emitting.
    await Promise.resolve();
    expect(fake.on).toHaveBeenCalledWith("navigate", expect.any(Function));

    // Wails SDK delivers a WailsEvent whose .data carries the emitted payload;
    // a bare string (older runtimes) must keep working.
    fake.emit({ data: "settings" });
    fake.emit("threshold");
    expect(callback).toHaveBeenNthCalledWith(1, "settings");
    expect(callback).toHaveBeenNthCalledWith(2, "threshold");

    fake.off.mockImplementation(() => {
      /* the SDK cancel handle */
    });
    fake.on.mock.results[0].value?.();
    fake.emit({ data: "threshold" });
    expect(callback).toHaveBeenCalledTimes(2);
    void cancel;
  });

  it("returns an off handle even when the runtime never arrives", async () => {
    const callback = vi.fn();
    const cancel = await subscribeNavigation(callback, async () =>
      Promise.reject(new Error("Desktop connection unavailable")),
    );
    expect(typeof cancel).toBe("function");
    expect(() => cancel()).not.toThrow();
    expect(callback).not.toHaveBeenCalled();
  });

  it("ignores payloads that are not known sections", async () => {
    const fake = fakeRuntimeModule();
    const callback = vi.fn();
    await subscribeNavigation(callback, async () => fake.module);
    await Promise.resolve();
    fake.emit({ data: 42 });
    fake.emit({ data: null });
    fake.emit({ data: "resume" });
    expect(callback).not.toHaveBeenCalled();
  });

  it("skips the callback fired after cancellation wins the race", async () => {
    const fake = fakeRuntimeModule();
    const callback = vi.fn();
    const cancel = await subscribeNavigation(callback, async () => fake.module);
    cancel();
    await Promise.resolve();
    fake.emit({ data: "settings" });
    expect(callback).not.toHaveBeenCalled();
    expect(fake.on).not.toHaveBeenCalled();
  });
});
