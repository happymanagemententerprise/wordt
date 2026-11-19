import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// This jsdom setup has no Storage implementation, so supply a tiny one.
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, String(value));
  },
  removeItem: (key: string) => {
    values.delete(key);
  },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() {
    return values.size;
  },
} as Storage;

Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });

afterEach(() => {
  cleanup();
  values.clear();
});
