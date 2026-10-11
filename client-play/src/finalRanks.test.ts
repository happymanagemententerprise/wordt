import { describe, expect, it } from 'vitest';

import { finalRanks, medalForRank } from './finalRanks';

const row = (score: number, validWordCount: number) => ({ score, validWordCount });

describe('finalRanks', () => {
  it('numbers distinct finishes 1, 2, 3, 4', () => {
    expect(finalRanks([row(30, 6), row(20, 5), row(10, 3), row(4, 1)])).toEqual([1, 2, 3, 4]);
  });

  it('gives tied rows the same rank and skips the next number', () => {
    expect(finalRanks([row(30, 6), row(30, 6), row(10, 3)])).toEqual([1, 1, 2]);
  });

  it('treats equal scores with different word counts as different places', () => {
    expect(finalRanks([row(30, 6), row(30, 4)])).toEqual([1, 2]);
  });

  it('ranks an empty table as empty', () => {
    expect(finalRanks([])).toEqual([]);
  });

  it('handles a three-way first-place tie', () => {
    expect(finalRanks([row(12, 2), row(12, 2), row(12, 2), row(1, 1)])).toEqual([1, 1, 1, 2]);
  });
});

describe('medalForRank', () => {
  it('awards gold, silver, bronze, then nothing', () => {
    expect([1, 2, 3, 4, 9].map(medalForRank)).toEqual(['gold', 'silver', 'bronze', null, null]);
  });
});
