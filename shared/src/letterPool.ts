import {
  CONSONANT_TIERS,
  ENGLISH_FREQUENCY_ORDER,
  LETTER_POOL,
  POOL_SIZE,
  USABLE_MIN_COUNT,
  VALUE_MIN,
  VOWELS,
  VOWEL_TIERS,
} from './config';
import { countPick } from './letterValues';
import type { Letter, LetterValueEntry, LetterValueTable } from './types';

const VOWEL_SET = new Set(VOWELS.split(''));

export function isVowel(letter: Letter): boolean {
  return VOWEL_SET.has(letter);
}

/** Standard Scrabble letter values, used for every computer-added letter. */
export const SCRABBLE_VALUES: Readonly<Record<Letter, number>> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8,
  Y: 4, Z: 10,
};

/** Letters picked by two or more players, in alphabet order. */
export function overlapLetters(picks: readonly (readonly Letter[])[]): Letter[] {
  const counts = countPick(picks);
  return [...LETTER_POOL].filter((letter) => (counts[letter] ?? 0) >= USABLE_MIN_COUNT);
}

export interface BuiltPool {
  /** Every letter available this round, including computer-added ones. */
  pool: Letter[];
  /** The letters the computer added to reach `poolSize` (alphabet order). */
  computerAdded: Letter[];
}

export type Rng = () => number;

/** Uniform sampling of `k` items without replacement, using the given rng. */
function sample<T>(items: readonly T[], k: number, rng: Rng): T[] {
  const arr = [...items];
  const take = Math.min(k, arr.length);
  for (let i = 0; i < take; i += 1) {
    const j = i + Math.floor(rng() * (arr.length - i));
    const tmp = arr[i];
    arr[i] = arr[j]!;
    arr[j] = tmp!;
  }
  return arr.slice(0, take);
}

/**
 * Builds the round's letter pool: the overlap letters plus a fair computer
 * top-up to a fixed `poolSize`. The top-up samples uniformly from the letters
 * nobody overlapped on, so it never chases high-value letters. If the overlap
 * includes no vowel, the top-up is steered to add one (when one remains), so a
 * round of all-consonant picks still has a usable vowel.
 */
export function buildPool(
  picks: readonly (readonly Letter[])[],
  poolSize = POOL_SIZE,
  rng: Rng = Math.random.bind(Math),
): BuiltPool {
  const overlap = overlapLetters(picks);
  const overlapSet = new Set(overlap);
  const candidates = [...LETTER_POOL].filter((letter) => !overlapSet.has(letter));

  const needed = Math.max(0, poolSize - overlap.length);
  let added: Letter[] = [];

  if (needed > 0 && candidates.length > 0) {
    const working = [...candidates];
    const needsVowel =
      needed > 1 && !overlap.some(isVowel) && working.some(isVowel);

    if (needsVowel) {
      const vowels = working.filter(isVowel);
      const vowel = sample(vowels, 1, rng)[0]!;
      added.push(vowel);
      const rest = working.filter((letter) => letter !== vowel);
      added.push(...sample(rest, needed - 1, rng));
    } else {
      added = sample(working, needed, rng);
    }
  }

  const addedSet = new Set(added);
  const pool = [...LETTER_POOL].filter(
    (letter) => overlapSet.has(letter) || addedSet.has(letter),
  );

  return { pool, computerAdded: added };
}

/** letter -> position in the fixed frequency order (lower = more common). */
const FREQUENCY_RANK: ReadonlyMap<Letter, number> = new Map(
  [...ENGLISH_FREQUENCY_ORDER].map((letter, index) => [letter, index]),
);

/**
 * Candidates for the round's rare letter: every alphabet letter that no player
 * drafted and the pool did not draw. The rare letter is drawn from this set, so
 * it can never duplicate a pick or a pool letter. May be empty when the room
 * collectively drafted the whole alphabet.
 */
export function rareLetterCandidates(
  picks: readonly (readonly Letter[])[],
  pool: readonly Letter[],
): Letter[] {
  const taken = new Set<Letter>(pool);
  for (const pick of picks) {
    for (const letter of pick) taken.add(letter);
  }
  return [...LETTER_POOL].filter((letter) => !taken.has(letter));
}

function frequencyRank(letter: Letter): number {
  const rank = FREQUENCY_RANK.get(letter);
  // Unknown letters sort last rather than throwing, so a bad pool cannot crash a round.
  return rank === undefined ? ENGLISH_FREQUENCY_ORDER.length : rank;
}

/** Assigns tier values to a ranked subset, splitting it into `tiers` groups. */
function tierValue(rankIndex: number, count: number, tiers: number): number {
  return Math.floor((rankIndex * tiers) / count) + VALUE_MIN;
}

/**
 * Values every letter in the pool.
 *
 * Computer-added letters score their fixed Scrabble value (nobody bet on them).
 * Player-overlap letters use the tension system: ranked by pick count, ties by
 * English frequency — but consonants and vowels rank inside their own pool, so
 * vowels never outpace consonants. Consonants spread over `CONSONANT_TIERS`
 * (1-5); vowels over just `VOWEL_TIERS`, so the most-picked vowel scores 1 and
 * the least-picked only 2.
 */
export function computeLetterValues(
  picks: readonly (readonly Letter[])[],
  pool: readonly Letter[],
  computerAdded: ReadonlySet<Letter>,
): LetterValueTable {
  const counts = countPick(picks);

  const addedEntries: LetterValueEntry[] = [];
  const overlapEntries: LetterValueEntry[] = [];
  for (const letter of pool) {
    if (computerAdded.has(letter)) {
      addedEntries.push({ letter, count: counts[letter] ?? 0, value: SCRABBLE_VALUES[letter] ?? 0 });
    } else {
      overlapEntries.push({ letter, count: counts[letter] ?? 0, value: 0 });
    }
  }

  const rankedOverlap = (letters: Letter[], tiers: number): LetterValueEntry[] =>
    letters
      .slice()
      .sort(
        (a, b) =>
          (counts[b] ?? 0) - (counts[a] ?? 0) ||
          frequencyRank(a) - frequencyRank(b) ||
          a.localeCompare(b),
      )
      .map((letter, index) => ({
        letter,
        count: counts[letter] ?? 0,
        value: tierValue(index, letters.length, tiers),
      }));

  const overlapVowels = rankedOverlap(
    overlapEntries.filter((entry) => isVowel(entry.letter)).map((entry) => entry.letter),
    VOWEL_TIERS,
  );
  const overlapConsonants = rankedOverlap(
    overlapEntries.filter((entry) => !isVowel(entry.letter)).map((entry) => entry.letter),
    CONSONANT_TIERS,
  );

  const entries = [...addedEntries, ...overlapVowels, ...overlapConsonants].sort(
    (a, b) =>
      a.value - b.value ||
      b.count - a.count ||
      frequencyRank(a.letter) - frequencyRank(b.letter),
  );

  const values: Record<Letter, number> = {};
  const source: Record<Letter, 'overlap' | 'added'> = {};
  const countsOut: Record<Letter, number> = {};
  for (const entry of entries) {
    values[entry.letter] = entry.value;
    countsOut[entry.letter] = entry.count;
    source[entry.letter] = computerAdded.has(entry.letter) ? 'added' : 'overlap';
  }

  return { entries, values, counts: countsOut, source };
}