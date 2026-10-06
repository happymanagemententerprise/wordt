import { describe, expect, it } from 'vitest';

import {
  lettersPerTeamMember,
  mergeTeam,
  scoreRound,
  type RoundPlayerInput,
} from '../src/index';

/** Worked-example values: E=1, T=2, R=3, so TREE = 7. */
const LETTER_VALUES = { E: 1, T: 2, R: 3, A: 4, O: 5, D: 2, L: 3 };

function player(
  id: string,
  validWords: string[],
  opts: Partial<RoundPlayerInput> = {},
): RoundPlayerInput {
  return {
    id,
    name: id.toUpperCase(),
    validWords,
    wrongTries: 0,
    totalTries: validWords.length,
    pick: [],
    ...opts,
  };
}

function round(players: RoundPlayerInput[]) {
  return { players, letterValues: LETTER_VALUES };
}

function bonusesOf(id: string, result: ReturnType<typeof scoreRound>): number {
  const found = result.players.find((p) => p.id === id);
  return found?.bonuses.reduce((sum, bonus) => sum + bonus.points, 0) ?? 0;
}

describe('draft penalty', () => {
  it('charges one point for every drafted letter that never reached a word', () => {
    const result = scoreRound(
      round([player('a', ['TREE'], { pick: ['T', 'R', 'E', 'Q', 'Z'] })]),
    );
    const a = result.players[0]!;

    expect(a.draftUnused).toEqual(['Q', 'Z']);
    expect(a.draftPenalty).toBe(-2);
    // 7 for TREE, minus the two wasted drafts, plus whatever bonuses it won.
    expect(a.roundScore).toBe(7 - 2 + bonusesOf('a', result));
  });

  it('costs nothing when every drafted letter is used', () => {
    const result = scoreRound(
      round([player('a', ['TREE'], { pick: ['T', 'R', 'E'] })]),
    );
    const a = result.players[0]!;

    expect(a.draftUnused).toEqual([]);
    expect(a.draftPenalty).toBe(0);
    expect(a.roundScore).toBe(7 + bonusesOf('a', result));
  });

  it('counts a shared letter as wasted if this player never spelled with it', () => {
    const result = scoreRound(
      round([
        player('a', ['TREE'], { pick: ['T', 'R', 'E', 'A'] }),
        player('b', ['RATE'], { pick: ['R', 'A', 'T', 'E'] }),
      ]),
    );

    expect(result.players.find((p) => p.id === 'a')?.draftUnused).toEqual(['A']);
    expect(result.players.find((p) => p.id === 'b')?.draftUnused).toEqual([]);
  });

  it('only lists units that actually lost points', () => {
    const result = scoreRound(
      round([
        player('a', ['TREE'], { pick: ['T', 'R', 'E', 'Q'] }),
        player('b', ['RATE'], { pick: ['R', 'A', 'T', 'E'] }),
      ]),
    );

    expect(result.draftPenalties).toHaveLength(1);
    expect(result.draftPenalties[0]?.id).toBe('a');
    expect(result.draftPenalties[0]?.label).toBe('A');
    expect(result.draftPenalties[0]?.points).toBe(-1);
    expect(result.draftPenalties[0]?.unused).toEqual(['Q']);
  });

  it('is reported for a team as one row labelled with the team name', () => {
    const merged = mergeTeam('A', [
      player('alice', ['TREE'], { pick: ['T', 'R', 'E', 'Q'], name: 'Alice' }),
      player('bob', ['RATE'], { pick: ['A'], name: 'Bob' }),
    ]);
    const result = scoreRound(
      round([merged, player('c', ['DEAL'], { name: 'Cara', pick: ['D', 'E', 'A', 'L'] })]),
    );

    expect(result.draftPenalties).toHaveLength(1);
    expect(result.draftPenalties[0]?.label).toBe('Team A');
    // Q and the unused A were already spent by the other member on RATE.
    expect(result.draftPenalties[0]?.points).toBe(-1);
  });
});

describe('team credit', () => {
  it('names the person in free-for-all play', () => {
    const result = scoreRound(
      round([player('a', ['TREE']), player('b', ['RED'])]),
    );

    const longest = result.statAwards.find((x) => x.stat === 'longest_word');
    expect(longest?.credit).toBe('A');
    expect(result.uniqueWords[0]?.credit).toBe('A');
  });

  it('shows the team and the member who found the word', () => {
    const merged = mergeTeam('A', [
      player('alice', ['TREE'], { name: 'Alice' }),
      player('bob', ['DEAL'], { name: 'Bob' }),
    ]);
    const result = scoreRound(
      round([merged, player('c', ['RED'], { name: 'Cara' })]),
    );

    const longest = result.statAwards.find((x) => x.stat === 'longest_word');
    expect(longest?.credit).toBe('Team A · Alice');
    expect(longest?.winners).toEqual(['A']);

    const best = result.statAwards.find((x) => x.stat === 'most_point_words');
    expect(best?.credit).toBe('Team A · Bob');

    expect(result.uniqueWords.map((u) => u.credit)).toEqual([
      'Team A · Bob',
      'Team A · Alice',
      'Cara',
    ]);
  });

  it('joins both teams when the stat is shared', () => {
    const result = scoreRound(
      round([
        mergeTeam('A', [player('alice', ['TREE'], { name: 'Alice' })]),
        mergeTeam('B', [player('dana', ['DEAL'], { name: 'Dana' })]),
      ]),
    );

    const longest = result.statAwards.find((x) => x.stat === 'longest_word');
    expect(longest?.winners).toEqual(['A', 'B']);
    expect(longest?.credit).toBe('Team A, Team B');
  });
});

describe('mergeTeam', () => {
  it('unions picks, sums tries and keeps one copy of a shared word', () => {
    const merged = mergeTeam('A', [
      player('alice', ['TREE', 'RATE'], { name: 'Alice', pick: ['T', 'R'], wrongTries: 1, totalTries: 3 }),
      player('bob', ['TREE'], { name: 'Bob', pick: ['E', 'A'], wrongTries: 2, totalTries: 2 }),
    ]);

    expect(merged.pick).toEqual(['T', 'R', 'E', 'A']);
    expect(merged.validWords).toEqual(['TREE', 'RATE']);
    expect(merged.wrongTries).toBe(3);
    expect(merged.totalTries).toBe(5);
    expect(merged.teamName).toBe('Team A');
    expect(merged.name).toBe('Team A');
    expect(merged.wordAuthors).toEqual({ TREE: 'Alice', RATE: 'Alice' });
  });

  it('merges no members into an empty unit', () => {
    const merged = mergeTeam('B', []);
    expect(merged.validWords).toEqual([]);
    expect(merged.pick).toEqual([]);
    expect(merged.name).toBe('Team B');
  });
});

describe('lettersPerTeamMember', () => {
  it('splits the team total over two members', () => {
    expect(lettersPerTeamMember(2)).toBe(5);
  });

  it('gives a solo member the whole team total', () => {
    expect(lettersPerTeamMember(1)).toBe(10);
  });

  it('never drops below one letter', () => {
    expect(lettersPerTeamMember(0)).toBe(10);
  });
});
