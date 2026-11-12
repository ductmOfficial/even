import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only auto-cleans when Vitest globals are enabled, so unmount rendered trees here.
afterEach(() => {
  cleanup();
});

// jsdom lacks these; cmdk calls them.
const noop = (): void => undefined;
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe = noop;
    unobserve = noop;
    disconnect = noop;
  };
}
Object.assign(Element.prototype, { scrollIntoView: noop });
