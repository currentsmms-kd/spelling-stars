/**
 * Vitest setup file
 * Runs before all tests to configure the testing environment
 */

import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock Web Crypto API for PIN hashing tests
if (typeof globalThis.crypto === "undefined") {
  const crypto = require("crypto").webcrypto;
  Object.defineProperty(globalThis, "crypto", {
    value: crypto,
    writable: true,
  });
}

// Mock window.matchMedia for components that use media queries
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {}, // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
