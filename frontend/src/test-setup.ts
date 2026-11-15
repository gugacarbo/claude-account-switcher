import "@testing-library/jest-dom/vitest";

// jsdom não implementa ResizeObserver; componentes Radix (ex.: Slider)
// observam tamanho no mount. Stub inerte: os testes exercitam semântica
// e teclado, não layout.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
