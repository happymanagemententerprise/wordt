import { describe, expect, it } from 'vitest';

import { ENGLISH_FREQUENCY_ORDER } from '../src/config';
import { computeLetterValues, countPick, scoreWord } from '../src/letterValues';

/**
 * Fixture: 2 players both pick the same 15 letters, so every usable letter ties
 * at count 2 and rarity order alone decides the values.
 */
const TWO_PLAYER_SAME_PICK = [...ENGLISH_FREQUENCY_ORDER].slice(0, 15);

describe('computeLetterValues', () => {
  it('sorts equal-count letters by English frequency order (2 players)', () => {
    const table = computeLetterValues(countPick([TWO_PLAYER_SAME_PICK, TWO_PLAYER_SAME_PICK]));

    expect(table.entries).toHaveLength(15);
    expect(table.entries.map((e) => e.letter).join('')).toBe('ETAOINSHRDLCUMW');

    // All counts tie at 2, so rarity alone decides value.
    for (const entry of table.entries) expect(entry.count).toBe(2);

    // floor(i*5/15)+1 => blocks of three.
    expect(table.values.E).toBe(1);
    expect(table.values.T).toBe(1);
    expect(table.values.A).toBe(1);
    expect(table.values.O).toBe(2);
    expect(table.values.I).toBe(2);
    expect(table.values.N).toBe(2);
    expect(table.values.S).toBe(3);
    expect(table.values.H).toBe(3);
    expect(table.values.R).toBe(3);
    expect(table.values.D).toBe(4);
    expect(table.values.L).toBe(4);
    expect(table.values.C).toBe(4);
    expect(table.values.U).toBe(5);
    expect(table.values.M).toBe(5);
    expect(table.values.W).toBe(5);
  });

  it('ranks higher counts above rarity', () => {
    // Z is picked by everyone, A only by two players. Count beats frequency.
    const table = computeLetterValues({ Z: 6, A: 2 });
    expect(table.entries.map((e) => e.letter)).toEqual(['Z', 'A']);
    expect(table.values.Z).toBe(1);
    expect(table.values.A).toBe(3);
  });

  it('assigns the worked example values E=1, T=2, R=3', () => {
    // Three letters at count 3 (ranks 0..2) plus two at count 2 (ranks 3..4).
    const table = computeLetterValues({ E: 3, T: 3, R: 3, A: 2, O: 2 });

    expect(table.entries.map((e) => e.letter)).toEqual(['E', 'T', 'R', 'A', 'O']);
    expect(table.values.E).toBe(1);
    expect(table.values.T).toBe(2);
    expect(table.values.R).toBe(3);
  });

  it('scores the worked example word TREE as 7', () => {
    const table = computeLetterValues({ E: 3, T: 3, R: 3, A: 2, O: 2 });
    expect(scoreWord('TREE', table.values)).toBe(2 + 3 + 1 + 1);
    expect(scoreWord('TREE', table.values)).toBe(7);
  });

  it('handles 6 players with a realistic spread of pick counts', () => {
    const players = [
      ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D'],
      ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'L'],
      ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'C'],
      ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D'],
      ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'L', 'C'],
      ['E', 'T', 'A', 'O', 'I', 'N', 'R', 'D', 'L', 'C'],
    ];

    const counts = countPick(players);
    expect(counts).toEqual({
      E: 6, T: 6, A: 6, O: 6, I: 6, N: 6,
      S: 5, H: 5, R: 5,
      D: 3, L: 3, C: 3,
    });

    const table = computeLetterValues(counts);
    expect(table.entries).toHaveLength(12);
    expect(table.entries[0]?.letter).toBe('E');
    expect(table.entries.map((e) => e.letter).join('')).toBe('ETAOINSHRDLC');
    expect(table.values).toEqual({
      E: 1, T: 1, A: 1,
      O: 2, I: 2,
      N: 3, S: 3, H: 3,
      R: 4, D: 4,
      L: 5, C: 5,
    });
  });

  it('handles fewer than 5 usable letters', () => {
    // Using letters in frequency order so the rank order is obvious.
    expect(computeLetterValues({ E: 2, T: 2 }).values).toEqual({ E: 1, T: 3 });
    expect(computeLetterValues({ E: 2, T: 2, A: 2 }).values).toEqual({ E: 1, T: 2, A: 4 });
    expect(computeLetterValues({ E: 2, T: 2, A: 2, O: 2 }).values).toEqual({
      E: 1, T: 2, A: 3, O: 4,
    });
    expect(computeLetterValues({ E: 2 }).values).toEqual({ E: 1 });
  });

  it('breaks equal counts by frequency, not alphabet', () => {
    // B sorts before C alphabetically, but C (index 11) outranks B (index 19).
    const table = computeLetterValues({ C: 2, B: 2 });
    expect(table.entries.map((e) => e.letter)).toEqual(['C', 'B']);
    expect(table.values.C).toBe(1);
    expect(table.values.B).toBe(3);
  });

  it('drops letters picked by fewer than two players', () => {
    const table = computeLetterValues({ E: 3, T: 1, A: 0 });
    expect(table.entries.map((e) => e.letter)).toEqual(['E']);
    expect(table.values).toEqual({ E: 1 });
    expect(table.counts).toEqual({ E: 3 });
  });

  it('returns an empty table when no letter is usable', () => {
    const table = computeLetterValues({});
    expect(table.entries).toEqual([]);
    expect(table.values).toEqual({});
    expect(table.counts).toEqual({});

    const allSingleton = computeLetterValues(
      Object.fromEntries([...ENGLISH_FREQUENCY_ORDER].map((l) => [l, 1])),
    );
    expect(allSingleton.entries).toEqual([]);
  });
});

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
