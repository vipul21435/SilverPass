import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * A deterministic localStorage for the suite.
 *
 * jsdom supplies one, but recent Node versions also expose an experimental
 * global `localStorage` that can win and does not implement the full Storage
 * interface. Installing our own removes the ambiguity, and it means tests can
 * simulate storage being unavailable when they need to.
 */
function installMemoryStorage() {
  const entries = new Map();
  const storage = {
    getItem: (key) => (entries.has(String(key)) ? entries.get(String(key)) : null),
    setItem: (key, value) => entries.set(String(key), String(value)),
    removeItem: (key) => entries.delete(String(key)),
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };

  for (const target of [window, globalThis]) {
    Object.defineProperty(target, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    });
  }
  return storage;
}

const storage = installMemoryStorage();

beforeEach(() => {
  // Settings and tokens live in storage; leaking them between tests would make
  // the order of the suite matter.
  storage.clear();
  document.documentElement.removeAttribute('data-text-size');
  document.documentElement.removeAttribute('data-contrast');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
