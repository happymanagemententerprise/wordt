import { beforeEach, describe, expect, it } from 'vitest';

import { loadSoloBest, recordSoloBest } from './soloBest';

// This jsdom setup has no Storage implementation, so supply a tiny one.
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, String(value)); },
  removeItem: (key: string) => { values.delete(key); },
  clear: () => values.clear(),
  key: (index: number) => [...values.keys()][index] ?? null,
  get length() { return values.size; },
} as Storage;

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  values.clear();
});

describe('solo personal best', () => {
  it('starts empty and stores the first finished practice game', () => {
    expect(loadSoloBest()).toBeNull();

    const { best, improved } = recordSoloBest(42, 3);
    expect(improved).toBe(true);
    expect(best.score).toBe(42);
    expect(best.rounds).toBe(3);
    expect(loadSoloBest()?.score).toBe(42);
  });

  it('only replaces the best when a new score beats it', () => {
    recordSoloBest(50, 5);

    const lower = recordSoloBest(30, 3);
    expect(lower.improved).toBe(false);
    expect(lower.best.score).toBe(50);

    const higher = recordSoloBest(80, 5);
    expect(higher.improved).toBe(true);
    expect(loadSoloBest()).toMatchObject({ score: 80, rounds: 5 });
  });

  it('ignores a corrupt stored value', () => {
    window.localStorage.setItem('wordt.solo.best', '{not json');
    expect(loadSoloBest()).toBeNull();
  });
});
