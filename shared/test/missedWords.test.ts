import { describe, expect, it } from 'vitest';

import { computeMissedWords } from '../src/dictionary';

const dictionary = new Set(['TREE', 'TRE', 'ATE', 'ATEABLE', 'BEAR', 'XX', 'ZZQ', 'ZEA']);
const pool = new Set(['T', 'R', 'E', 'A', 'B', 'L', 'X', 'Z']);
const values = { T: 1, R: 3, E: 1, A: 1, B: 3, L: 4, X: 8, Z: 10 } as Record<string, number>;

// Formable words and their points: XX 16, ATEABLE 12, ZEA 12, BEAR 8, TREE 6,
// TRE 5, ATE 3. ZZQ contains Q (not in pool) so it can never form.

describe('computeMissedWords', () => {
  it('returns the best formable words nobody submitted, best-value first', () => {
    const missed = computeMissedWords(dictionary, pool, values, new Set(['TREE']), 10);
    expect(missed[0]?.word).toBe('XX');
    expect(missed[1]?.word).toBe('ATEABLE');
    expect(missed.map((m) => m.word)).not.toContain('TREE');
    expect(missed.map((m) => m.word)).not.toContain('ZZQ');
  });

  it('breaks point ties by length, then alphabetically', () => {
    const missed = computeMissedWords(dictionary, pool, values, new Set(), 10);
    // ATEABLE and ZEA both score 12; the longer word ranks first.
    const twelve = missed.filter((m) => m.points === 12).map((m) => m.word);
    expect(twelve).toEqual(['ATEABLE', 'ZEA']);
  });

  it('excludes submitted words and words that need unpicked letters', () => {
    const missed = computeMissedWords(dictionary, pool, values, new Set(['XX', 'ATEABLE']), 10);
    expect(missed.some((m) => m.word === 'XX')).toBe(false);
    expect(missed.some((m) => m.word === 'ATEABLE')).toBe(false);
    expect(missed.some((m) => m.word === 'ZZQ')).toBe(false);
  });

  it('caps the list at the requested count', () => {
    const capped = computeMissedWords(dictionary, pool, values, new Set(), 3);
    expect(capped).toHaveLength(3);
    expect(capped.map((m) => m.word)).toEqual(['XX', 'ATEABLE', 'ZEA']);
  });

  it('returns an empty list when every formable word is submitted', () => {
    expect(computeMissedWords(new Set(['AT']), pool, values, new Set(['AT']))).toEqual([]);
  });
});