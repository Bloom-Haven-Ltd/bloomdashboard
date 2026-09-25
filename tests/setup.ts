import '@testing-library/jest-dom/vitest';

// jsdom lacks full crypto.randomUUID in some Node versions — polyfill deterministically.
import { webcrypto } from 'node:crypto';

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
