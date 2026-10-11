import type { PublicPlayer } from '@wordt/shared';

export type MedalKind = 'gold' | 'silver' | 'bronze';

/**
 * Assign a finishing position to each final-standings row, best first.
 *
 * The server already orders the rows (score desc, then valid words desc), so we
 * only collapse runs of tied rows here — we never re-sort or re-score. Two rows
 * tie when they match on both score and valid-word count, the same "still level"
 * rule the server uses to share a win. Tied rows share a rank and the next
 * distinct group takes the next number (1, 1, 2, …), which is how the medals
 * read out.
 */
export function finalRanks(
  players: readonly Pick<PublicPlayer, 'score' | 'validWordCount'>[],
): number[] {
  const ranks: number[] = [];
  let rank = 0;
  let prevScore: number | null = null;
  let prevWords: number | null = null;

  for (const player of players) {
    if (player.score !== prevScore || player.validWordCount !== prevWords) {
      rank += 1;
      prevScore = player.score;
      prevWords = player.validWordCount;
    }
    ranks.push(rank);
  }

  return ranks;
}

/** The medal for a finishing position, or null for everyone past third place. */
export function medalForRank(rank: number): MedalKind | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}

/** True when the visitor asked their OS to keep motion to a minimum. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
