import type { FeedItem, PublicRoomState } from '@wordt/shared';

/**
 * How each standings row moved since the last round landed: positive climbed,
 * negative dropped, and rows missing from the map did not move. Empty until a
 * round has been scored.
 */
export function rankChanges(state: PublicRoomState): Map<string, number> {
  const result = state.lastRoundResult;
  if (!result) return new Map();

  const lastRound = new Map(result.players.map((entry) => [entry.id, entry.roundScore]));
  const previous = state.standings
    .map((row, index) => ({
      id: row.id,
      name: row.name,
      words: row.validWordCount,
      score: row.score - (lastRound.get(row.id) ?? 0),
      index,
    }))
    .sort((a, b) => b.score - a.score || b.words - a.words || a.name.localeCompare(b.name));

  const changes = new Map<string, number>();
  previous.forEach((row, prevIndex) => {
    const delta = prevIndex - row.index;
    if (delta !== 0) changes.set(row.id, delta);
  });
  return changes;
}

/** For every feed entry (oldest first), the length of that player's run. */
export function feedStreaks(feed: readonly FeedItem[]): number[] {
  let run = 0;
  let previous: string | null = null;
  return feed.map((item) => {
    run = item.playerId === previous ? run + 1 : 1;
    previous = item.playerId;
    return run;
  });
}
