import type { Letter } from './types';

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