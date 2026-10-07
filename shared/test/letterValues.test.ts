import { describe, expect, it } from 'vitest';

import { countPick, scoreWord } from '../src/letterValues';

describe('scoreWord', () => {
  it('sums letter values', () => {
    expect(scoreWord('TREE', { T: 2, R: 3, E: 1 })).toBe(7);
    expect(scoreWord('', { E: 1 })).toBe(0);
  });

  it('scores unknown letters as zero rather than throwing', () => {
    expect(scoreWord('XYZ', { X: 5 })).toBe(5);
  });
});

describe('countPick', () => {
  it('tallies how many players picked each letter', () => {
    expect(countPick([['A', 'B'], ['A'], []])).toEqual({ A: 2, B: 1 });
    expect(countPick([])).toEqual({});
  });
});