import { describe, expect, it } from 'vitest';

import { ENGLISH_FREQUENCY_ORDER, LETTER_POOL, POOL_SIZE, VOWELS } from '../src/config';
import { buildPool, computeLetterValues, drawSessionRareLetter, overlapLetters, rareLetterCandidates } from '../src/letterPool';
import type { Letter } from '../src/types';

const LETTERS = [...LETTER_POOL] as Letter[];
const VOWEL_SET = new Set(VOWELS.split(''));

/** A deterministic rng (0.1, 0.2, ...) so sampling is repeatable. */
function seqRng(seed = 0): () => number {
  let n = seed;
  return () => {
    n += 1;
    return (n % 10) / 10;
  };
}

/** The 15 most common letters; two identical players pick these, so the whole
 *  pool ties at count 2 and rarity order alone decides the overlap values. */
const TWO_PLAYER_SAME_PICK = [...ENGLISH_FREQUENCY_ORDER].slice(0, 15) as Letter[];

/** Builds a table for the given picks, mirroring the server: pool from
 *  `buildPool`, values from `computeLetterValues`. */
function tableFor(picks: readonly (readonly Letter[])[]): ReturnType<typeof computeLetterValues> {
  const { pool, computerAdded } = buildPool(picks, POOL_SIZE, seqRng());
  return computeLetterValues(picks, pool, new Set(computerAdded));
}

/** Tiers only the given pool, with no computer top-up. */
function valuesFor(pool: readonly Letter[], picks: readonly (readonly Letter[])[]): ReturnType<typeof computeLetterValues> {
  return computeLetterValues(picks, pool, new Set());
}

describe('buildPool', () => {
  it('tops a small overlap up to POOL_SIZE with randomly added letters', () => {
    const picks = [['E', 'T'] as Letter[], ['E', 'T'] as Letter[]];
    const { pool, computerAdded } = buildPool(picks, POOL_SIZE, seqRng());

    expect(pool).toHaveLength(POOL_SIZE);
    expect(new Set(pool).has('E')).toBe(true);
    expect(new Set(pool).has('T')).toBe(true);
    expect(computerAdded).toHaveLength(POOL_SIZE - 2);
    for (const letter of computerAdded) {
      expect(letter).not.toBe('E');
      expect(letter).not.toBe('T');
    }
  });

  it('keeps the overlap intact even when it already fills the pool', () => {
    const picks = [TWO_PLAYER_SAME_PICK, TWO_PLAYER_SAME_PICK];
    const { pool, computerAdded } = buildPool(picks, POOL_SIZE, seqRng());
    expect(pool).toHaveLength(POOL_SIZE);
    expect(computerAdded).toHaveLength(0);
    expect([...pool].sort()).toEqual([...TWO_PLAYER_SAME_PICK].sort());
  });

  it('always adds a vowel when the overlap has none (and one is left)', () => {
    const picks = [
      ['T', 'N'] as Letter[],
      ['T', 'N'] as Letter[],
      ['T', 'N'] as Letter[],
      ['T', 'N'] as Letter[],
    ];
    const { pool } = buildPool(picks, POOL_SIZE, seqRng());
    expect(pool.some((letter) => VOWEL_SET.has(letter))).toBe(true);
  });
});

describe('computeLetterValues', () => {
  it('ranks consonants among consonants and vowels among vowels', () => {
    const table = tableFor([TWO_PLAYER_SAME_PICK, TWO_PLAYER_SAME_PICK]);

    expect(table.entries).toHaveLength(POOL_SIZE);
    for (const entry of table.entries) expect(entry.count).toBe(2);

    const values = table.values;
    expect(values.E).toBe(1);
    expect(values.T).toBe(1);
    expect(values.A).toBe(1);
    expect(values.O).toBe(1);
    expect(values.I).toBe(2);
    expect(values.U).toBe(2);
    expect(values.N).toBe(1);
    expect(values.S).toBe(2);
    expect(values.H).toBe(2);
    expect(values.R).toBe(3);
    expect(values.D).toBe(3);
    expect(values.L).toBe(4);
    expect(values.C).toBe(4);
    expect(values.M).toBe(5);
    expect(values.W).toBe(5);
  });

  it('ranks higher pick counts above rarity within each group', () => {
    const picks = [['Z', 'A'] as Letter[], ['Z'] as Letter[], ['Z'] as Letter[]];
    const table = valuesFor(['A', 'Z'] as Letter[], picks);

    expect(table.entries.map((e) => e.letter)).toEqual(['Z', 'A']);
    expect(table.values.Z).toBe(1);
    expect(table.values.A).toBe(1);
  });

  it('gives the cheap vowel its own tier regardless of pick volume', () => {
    // E is the single vowel in a small pool, so it stays at 1 next to scarce consonants.
    const table = valuesFor(['E', 'Q'] as Letter[], [['E', 'Q'] as Letter[], ['E', 'Q'] as Letter[]]);
    expect(table.values.E).toBe(1);
    expect(table.values.Q).toBe(1);
  });

  it('spreads few consonants over the tier ladder', () => {
    const table = valuesFor(['C', 'B'] as Letter[], [['C', 'B'] as Letter[], ['C', 'B'] as Letter[]]);
    expect(table.entries.map((e) => e.letter)).toEqual(['C', 'B']);
    expect(table.values.C).toBe(1);
    expect(table.values.B).toBe(3);
  });

  it('marks computer-added letters with their Scrabble value and their source', () => {
    const picks = [['E', 'T'] as Letter[], ['E', 'T'] as Letter[]];
    const { pool, computerAdded } = buildPool(picks, POOL_SIZE, seqRng());
    const table = computeLetterValues(picks, pool, new Set(computerAdded));

    expect(table.source.E).toBe('overlap');
    expect(table.source.T).toBe('overlap');
    expect(table.values.E).toBe(1);
    expect(table.values.T).toBe(1);

    const added = computerAdded[0] as Letter;
    expect(table.source[added]).toBe('added');
    expect(table.values[added]).toBeGreaterThanOrEqual(1);
  });

  it('uses every pool letter, including computer-added ones', () => {
    const picks = [[] as Letter[], [] as Letter[]];
    const { pool, computerAdded } = buildPool(picks, POOL_SIZE, seqRng());
    const table = computeLetterValues(picks, pool, new Set(computerAdded));

    expect(pool).toHaveLength(POOL_SIZE);
    expect(computerAdded).toHaveLength(POOL_SIZE);
    expect(table.entries).toHaveLength(POOL_SIZE);
    for (const entry of table.entries) {
      expect(entry.count).toBe(0);
      expect(entry.value).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('overlapLetters', () => {
  it('keeps only letters picked by two or more players', () => {
    expect(overlapLetters([['A', 'B'] as Letter[], ['A'] as Letter[], ['A'] as Letter[]])).toEqual([
      'A',
    ]);
  });

  it('returns an empty list when no letter reaches the threshold', () => {
    expect(overlapLetters([['A'] as Letter[], ['B'] as Letter[]])).toEqual([]);
  });
});

describe('rareLetterCandidates', () => {
  it('excludes every letter any player drafted and every pool letter', () => {
    const picks = [
      ['A', 'B', 'C'] as Letter[],
      ['C', 'D', 'E'] as Letter[],
    ];
    const pool = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S'] as Letter[];

    const candidates = rareLetterCandidates(picks, pool);
    for (const letter of candidates) {
      expect(picks.flat()).not.toContain(letter);
      expect(pool).not.toContain(letter);
    }
  });

  it('covers the consonants that were not drafted, exactly once', () => {
    const picks = [['E', 'T', 'A', 'O'] as Letter[]];
    const pool = ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D', 'L', 'C', 'U', 'M', 'W'] as Letter[];

    const taken = new Set([...picks.flat(), ...pool]);
    const expected = [...LETTER_POOL].filter(
      (letter) => !taken.has(letter) && !VOWEL_SET.has(letter),
    );
    const candidates = rareLetterCandidates(picks, pool);
    expect([...candidates].sort()).toEqual([...expected].sort());
    for (const letter of candidates) expect(VOWEL_SET.has(letter)).toBe(false);
  });

  it('returns an empty list when the players drafted the whole alphabet', () => {
    const whole = [...LETTER_POOL] as Letter[];
    const picks = [whole];

    expect(rareLetterCandidates(picks, [])).toEqual([]);
  });
});

describe('drawSessionRareLetter', () => {
  /** Drafts everything except the given letters, leaving them as the only consonants. */
  function pickedEverythingExcept(letters: Letter[]): { picks: Letter[][]; pool: Letter[] } {
    const rest = [...LETTER_POOL].filter((letter) => !letters.includes(letter)) as Letter[];
    return { picks: [rest], pool: [] };
  }

  it('never draws a vowel', () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const { picks, pool } = pickedEverythingExcept(['Z'] as Letter[]);
      const letter = drawSessionRareLetter(picks, pool, seqRng(seed));
      expect(letter).toBe('Z');
      expect(VOWEL_SET.has(letter!)).toBe(false);
    }
  });

  it('remains a plain consonant when only one candidate remains', () => {
    // Everything except K is drafted, leaving K as the only consonant.
    const { picks, pool } = pickedEverythingExcept(['K'] as Letter[]);
    expect(drawSessionRareLetter(picks, pool)).toBe('K');
  });

  it('weights boosted letters above ordinary consonants', () => {
    const { picks, pool } = pickedEverythingExcept(['K', 'Q'] as Letter[]);
    // roll 0.5 * 4 = 2.0: clears K (weight 1), lands inside Q (weight 3).
    expect(drawSessionRareLetter(picks, pool, () => 0.5)).toBe('Q');
    // roll 0.1 * 4 = 0.4: lands inside K (weight 1).
    expect(drawSessionRareLetter(picks, pool, () => 0.1)).toBe('K');
  });

  it('returns null when no consonants remain', () => {
    const consonants = [...LETTER_POOL].filter((letter) => !VOWEL_SET.has(letter)) as Letter[];
    expect(drawSessionRareLetter([consonants], [])).toBeNull();
  });
});