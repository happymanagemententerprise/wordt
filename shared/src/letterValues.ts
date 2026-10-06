import {
  ENGLISH_FREQUENCY_ORDER,
  USABLE_MIN_COUNT,
  VALUE_MAX,
  VALUE_MIN,
} from './config';
import type { Letter, LetterValueEntry, LetterValueTable } from './types';

/** letter -> position in the fixed frequency order (lower = more common). */
const FREQUENCY_RANK: ReadonlyMap<Letter, number> = new Map(
  [...ENGLISH_FREQUENCY_ORDER].map((letter, index) => [letter, index]),
);

function frequencyRank(letter: Letter): number {
  const rank = FREQUENCY_RANK.get(letter);
  // Unknown letters sort last rather than throwing, so a bad pick list cannot crash a round.
  return rank === undefined ? ENGLISH_FREQUENCY_ORDER.length : rank;
}

/**
 * Assigns point values 1..5 to every usable letter.
 *
 * Sort usable letters by pick count descending, breaking ties with the fixed
 * English frequency order (more common first). The letter at 0-based rank i of
 * n usable letters receives `floor(i * 5 / n) + 1`, so the most picked and most
 * common letters are worth 1 and the rarest reach 5.
 */
export function computeLetterValues(
  pickCounts: Readonly<Record<Letter, number>>,
): LetterValueTable {
  const usable: LetterValueEntry[] = Object.entries(pickCounts)
    .filter(([, count]) => count >= USABLE_MIN_COUNT)
    .map(([letter, count]) => ({ letter, count, value: 0 }));

  usable.sort(
    (a, b) =>
      b.count - a.count ||
      frequencyRank(a.letter) - frequencyRank(b.letter) ||
      a.letter.localeCompare(b.letter),
  );

  const n = usable.length;
  for (let i = 0; i < n; i += 1) {
    const entry = usable[i]!;
    entry.value = Math.floor((i * VALUE_MAX) / n) + VALUE_MIN;
  }

  const values: Record<Letter, number> = {};
  const counts: Record<Letter, number> = {};
  for (const entry of usable) {
    values[entry.letter] = entry.value;
    counts[entry.letter] = entry.count;
  }

  return { entries: usable, values, counts };
}

/** Sums the point value of every letter in a word. Letters not in the table score 0. */
export function scoreWord(
  word: string,
  letterValues: Readonly<Record<Letter, number>>,
): number {
  let total = 0;
  for (const letter of word) {
    total += letterValues[letter] ?? 0;
  }
  return total;
}

/** Counts how many players picked each letter. Each player's pick is already de-duplicated. */
export function countPick(picks: readonly (readonly Letter[])[]): Record<Letter, number> {
  const counts: Record<Letter, number> = {};
  for (const pick of picks) {
    for (const letter of pick) {
      counts[letter] = (counts[letter] ?? 0) + 1;
    }
  }
  return counts;
}
