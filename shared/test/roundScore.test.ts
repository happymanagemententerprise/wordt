import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SCORING_CONFIG,
  determineWinners,
  scoreRound,
  sortStandings,
  type RoundPlayerInput,
  type RoundScoreInput,
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

function round(players: RoundPlayerInput[]): RoundScoreInput {
  return { players, letterValues: LETTER_VALUES };
}

function bonusTotal(id: string, result: ReturnType<typeof scoreRound>): number {
  const p = result.players.find((x) => x.id === id);
  return p?.bonuses.reduce((sum, b) => sum + b.points, 0) ?? 0;
}

describe('scoreRound', () => {
  it('scores TREE as 7 using the worked-example values', () => {
    const result = scoreRound(round([player('a', ['TREE'])]));

    expect(result.players[0]?.wordPoints.TREE).toBe(7);
    expect(result.players[0]?.baseScore).toBe(7);
  });

  describe('2 players, every usable letter tied at count 2', () => {
    it('awards unique words and the shared-word penalty', () => {
      const result = scoreRound(
        round([player('a', ['TREE']), player('b', ['RATE'])]),
      );

      const a = result.players.find((p) => p.id === 'a')!;
      const b = result.players.find((p) => p.id === 'b')!;

      expect(a.baseScore).toBe(7);
      // RATE = 4+4+5+1... uses A,O,T,E => verify against table.
      expect(b.baseScore).toBe(
        LETTER_VALUES.R + LETTER_VALUES.A + LETTER_VALUES.T + LETTER_VALUES.E,
      );

      // Both words are unique to one player.
      expect(result.uniqueWords).toHaveLength(2);
      expect(a.bonuses.find((x) => x.stat === 'unique_word')?.points).toBe(2);
      expect(b.bonuses.find((x) => x.stat === 'unique_word')?.points).toBe(2);
    });
  });

  describe('everyone submits the same word', () => {
    it('nets the shared word to zero for every player', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE']),
          player('b', ['TREE']),
          player('c', ['TREE']),
        ]),
      );

      for (const p of result.players) {
        expect(p.baseScore).toBe(7);
        expect(p.sameWordPenalty).toBe(-7);
      }

      // Nobody has a unique word, so no unique-word bonuses.
      expect(result.uniqueWords).toEqual([]);

      // TREE was submitted by all 3 => most-used highlight, no points.
      expect(result.mostUsedWords).toEqual(['TREE']);
      expect(result.statAwards.find((a) => a.stat === 'most_used_word')).toBeUndefined();
    });

    it('leaves non-shared words intact while zeroing the shared one', () => {
      const result = scoreRound(
        round([player('a', ['TREE', 'DOLL']), player('b', ['TREE'])]),
      );

      const a = result.players.find((p) => p.id === 'a')!;
      // TREE=7 shared, DOLL=13 unique to a.
      expect(a.baseScore).toBe(7 + 13);
      expect(a.sameWordPenalty).toBe(-7);
      expect(a.roundScore).toBe(7 + 13 - 7 + bonusTotal('a', result));
    });
  });

  describe('a silent player', () => {
    it('scores zero and is never eligible for accuracy', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE', 'RATE'], { wrongTries: 1, totalTries: 3 }),
          player('b', [], { wrongTries: 0, totalTries: 0 }),
        ]),
      );

      const silent = result.players.find((p) => p.id === 'b')!;
      expect(silent.baseScore).toBe(0);
      expect(silent.roundScore).toBe(0);
      expect(silent.accuracy).toBeNull();

      const accuracy = result.statAwards.find((a) => a.stat === 'best_accuracy');
      expect(accuracy?.winners).toEqual(['a']);
    });

    it('does not trigger the same-word penalty', () => {
      const result = scoreRound(
        round([player('a', ['TREE']), player('b', ['TREE']), player('c', [])]),
      );

      // Not ALL players submitted TREE, so nobody is penalised.
      for (const p of result.players) expect(p.sameWordPenalty).toBe(0);
    });
  });

  describe('stat bonuses', () => {
    it('gives most created words to the player with the most valid words', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE', 'RATE', 'DEAL']),
          player('b', ['TREE']),
        ]),
      );

      const award = result.statAwards.find((x) => x.stat === 'most_created_words');
      expect(award?.winners).toEqual(['a']);
      expect(award?.points).toBe(2);
      expect(bonusTotal('a', result)).toBeGreaterThanOrEqual(2);
    });

    it('gives longest word to the player holding it', () => {
      const result = scoreRound(
        round([player('a', ['TREE']), player('b', ['DEALER'])]),
      );

      const award = result.statAwards.find((x) => x.stat === 'longest_word');
      expect(award?.winners).toEqual(['b']);
      expect(award?.value).toBe(6);
    });

    it('gives highest-scoring word to the best single word', () => {
      const result = scoreRound(
        round([player('a', ['TREE']), player('b', ['ODE', 'ODES'])]),
      );

      const award = result.statAwards.find((x) => x.stat === 'most_point_words');
      expect(award?.winners).toEqual(['b']);
      expect(award?.value).toBe(LETTER_VALUES.O + LETTER_VALUES.D + LETTER_VALUES.E);
    });
  });

  describe('stat ties', () => {
    it('shares points with every tied player when SHARE_POINTS_ON_STAT_TIES', () => {
      const result = scoreRound(
        round([player('a', ['TREE']), player('b', ['RATE'])]),
      );

      // Both created exactly one word of length 4, so both stats tie.
      for (const stat of ['most_created_words', 'longest_word']) {
        const award = result.statAwards.find((x) => x.stat === stat);
        expect(award?.winners).toEqual(['a', 'b']);
        expect(award?.points).toBe(2);
      }

      // Both players received the shared bonus, so their shared-stat totals match.
      const sharedStats = ['most_created_words', 'longest_word'];
      const sharedTotal = (id: string) =>
        result.players
          .find((p) => p.id === id)!
          .bonuses.filter((b) => sharedStats.includes(b.stat))
          .reduce((sum, b) => sum + b.points, 0);
      expect(sharedTotal('a')).toBe(4);
      expect(sharedTotal('b')).toBe(4);
    });

    it('awards nobody on a tie when sharing is disabled', () => {
      const result = scoreRound(round([player('a', ['TREE']), player('b', ['RATE'])]), {
        ...DEFAULT_SCORING_CONFIG,
        sharePointsOnStatTies: false,
      });

      const award = result.statAwards.find((x) => x.stat === 'most_created_words');
      expect(award?.winners).toEqual(['a', 'b']);
      expect(award?.points).toBe(0);

      // Neither player received points for the tied stat.
      for (const p of result.players) {
        expect(p.bonuses.some((b) => b.stat === 'most_created_words')).toBe(false);
      }

      // A lone winner still gets paid: b holds the only top-scoring word.
      const lone = result.statAwards.find((x) => x.stat === 'most_point_words');
      expect(lone?.winners).toEqual(['b']);
      expect(lone?.points).toBe(2);
    });
  });

  describe('best accuracy', () => {
    it('gives +1 to the lowest wrong/total ratio', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE'], { wrongTries: 3, totalTries: 4 }),
          player('b', ['TREE'], { wrongTries: 1, totalTries: 4 }),
        ]),
      );

      const award = result.statAwards.find((x) => x.stat === 'best_accuracy');
      expect(award?.winners).toEqual(['b']);
      expect(award?.points).toBe(1);
    });

    it('excludes players with zero tries', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE'], { wrongTries: 2, totalTries: 4 }),
          player('b', [], { wrongTries: 0, totalTries: 0 }),
        ]),
      );

      const award = result.statAwards.find((x) => x.stat === 'best_accuracy');
      expect(award?.winners).toEqual(['a']);
    });

    it('excludes players with zero valid words even if they tried', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE'], { wrongTries: 2, totalTries: 4 }),
          player('b', [], { wrongTries: 0, totalTries: 4 }),
        ]),
      );

      const award = result.statAwards.find((x) => x.stat === 'best_accuracy');
      expect(award?.winners).toEqual(['a']);
    });

    it('excludes players below the 0.5x average valid-word threshold', () => {
      // 4 players, 10 valid words total => average 2.5 => threshold 1.25.
      // 'c' has 1 valid word, the best accuracy, but is not eligible.
      const result = scoreRound(
        round([
          player('a', ['TREE', 'RATE', 'DEAL'], { wrongTries: 3, totalTries: 4 }),
          player('b', ['TREE', 'RATE', 'DEAL'], { wrongTries: 3, totalTries: 4 }),
          player('c', ['ODE'], { wrongTries: 0, totalTries: 1 }),
          player('d', ['TREE', 'RATE', 'DEAL'], { wrongTries: 3, totalTries: 4 }),
        ]),
      );

      const award = result.statAwards.find((x) => x.stat === 'best_accuracy');
      expect(award?.winners).not.toContain('c');
      expect(award?.winners?.every((id) => ['a', 'b', 'd'].includes(id))).toBe(true);
    });

    it('breaks an accuracy tie on most valid words', () => {
      const result = scoreRound(
        round([
          player('a', ['TREE'], { wrongTries: 1, totalTries: 2 }),
          player('b', ['TREE', 'RATE', 'ODES'], { wrongTries: 1, totalTries: 2 }),
        ]),
      );

      const award = result.statAwards.find((x) => x.stat === 'best_accuracy');
      expect(award?.winners).toEqual(['b']);
    });

    it('awards nobody when nobody is eligible', () => {
      const result = scoreRound(
        round([player('a', [], { wrongTries: 0, totalTries: 0 })]),
      );

      expect(result.statAwards.find((x) => x.stat === 'best_accuracy')).toBeUndefined();
    });
  });

  describe('zero usable letters', () => {
    it('produces an all-zero round that still completes', () => {
      const result = scoreRound({
        players: [player('a', []), player('b', [])],
        letterValues: {},
      });

      expect(result.players.map((p) => p.roundScore)).toEqual([0, 0]);
      expect(result.uniqueWords).toEqual([]);
      expect(result.mostUsedWords).toEqual([]);
      expect(result.statAwards).toEqual([]);
    });
  });

  describe('round score assembly', () => {
    it('adds base, same-word penalty and every bonus together', () => {
      const result = scoreRound(
        round([player('a', ['TREE']), player('b', ['TREE'])]),
      );

      for (const p of result.players) {
        const bonusSum = p.bonuses.reduce((s, b) => s + b.points, 0);
        expect(p.roundScore).toBe(p.baseScore + p.sameWordPenalty + bonusSum);
      }
    });
  });
});

describe('standings', () => {
  it('sorts by score then by total valid words', () => {
    const sorted = sortStandings([
      { id: 'a', name: 'Ana', score: 10, totalValidWords: 2 },
      { id: 'b', name: 'Bob', score: 10, totalValidWords: 5 },
      { id: 'c', name: 'Cid', score: 12, totalValidWords: 1 },
    ]);

    expect(sorted.map((s) => s.id)).toEqual(['c', 'b', 'a']);
  });

  it('declares a shared win when score and word count both tie', () => {
    const view = determineWinners([
      { id: 'a', name: 'Ana', score: 10, totalValidWords: 3 },
      { id: 'b', name: 'Bob', score: 10, totalValidWords: 3 },
      { id: 'c', name: 'Cid', score: 9, totalValidWords: 9 },
    ]);

    expect(view.winners.map((w) => w.id)).toEqual(['a', 'b']);
    expect(view.shared).toBe(true);
  });

  it('declares a single winner on a clean score lead', () => {
    const view = determineWinners([
      { id: 'a', name: 'Ana', score: 10, totalValidWords: 3 },
      { id: 'b', name: 'Bob', score: 10, totalValidWords: 2 },
    ]);

    expect(view.winners.map((w) => w.id)).toEqual(['a']);
    expect(view.shared).toBe(false);
  });

  it('handles an empty game', () => {
    expect(determineWinners([])).toEqual({ winners: [], shared: false });
  });
});
