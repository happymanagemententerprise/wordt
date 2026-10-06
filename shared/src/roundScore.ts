import {
  ACCURACY_MIN_FRACTION_OF_AVERAGE,
  BONUS_BEST_ACCURACY,
  BONUS_LONGEST_WORD,
  BONUS_MOST_CREATED_WORDS,
  BONUS_MOST_POINT_WORDS,
  BONUS_MOST_UNIQUE_WORDS,
  BONUS_UNIQUE_WORD,
  DRAFT_PENALTY_PER_UNUSED_LETTER,
  SHARE_POINTS_ON_STAT_TIES,
} from './config';
import { scoreWord } from './letterValues';
import type {
  DraftPenaltyEntry,
  Letter,
  PlayerId,
  PlayerRoundResult,
  RoundPlayerInput,
  RoundResult,
  RoundScoreInput,
  StatAward,
  UniqueWordReveal,
} from './types';

export interface ScoringConfig {
  sharePointsOnStatTies: boolean;
  accuracyMinFractionOfAverage: number;
  bonuses: {
    uniqueWord: number;
    mostUniqueWords: number;
    mostCreatedWords: number;
    longestWord: number;
    mostPointWords: number;
    bestAccuracy: number;
  };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  sharePointsOnStatTies: SHARE_POINTS_ON_STAT_TIES,
  accuracyMinFractionOfAverage: ACCURACY_MIN_FRACTION_OF_AVERAGE,
  bonuses: {
    uniqueWord: BONUS_UNIQUE_WORD,
    mostUniqueWords: BONUS_MOST_UNIQUE_WORDS,
    mostCreatedWords: BONUS_MOST_CREATED_WORDS,
    longestWord: BONUS_LONGEST_WORD,
    mostPointWords: BONUS_MOST_POINT_WORDS,
    bestAccuracy: BONUS_BEST_ACCURACY,
  },
};

/**
 * Scores one round. Pure: no clock, no I/O, no randomness.
 *
 * Runs in a fixed order so the review sequence shown on the TV is stable:
 * base scores, same-word penalty, draft penalty, unique words, then each stat
 * bonus, then the highlight-only most-used word.
 */
export function scoreRound(
  input: RoundScoreInput,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): RoundResult {
  const players = input.players;

  const results = new Map<PlayerId, PlayerRoundResult>();

  for (const player of players) {
    const wordPoints: Record<string, number> = {};
    let base = 0;
    for (const word of player.validWords) {
      const points = scoreWord(word, input.letterValues);
      wordPoints[word] = points;
      base += points;
    }

    // Who found what, so a merged team can still credit an individual.
    let longestLength = 0;
    let longestAuthor: string | null = null;
    let bestPoints = 0;
    let bestAuthor: string | null = null;
    for (const word of player.validWords) {
      const author = player.wordAuthors?.[word] ?? player.name;
      const points = wordPoints[word] ?? 0;
      if (word.length > longestLength) {
        longestLength = word.length;
        longestAuthor = author;
      }
      if (points > bestPoints) {
        bestPoints = points;
        bestAuthor = author;
      }
    }

    const draftUnused = unusedDraftedLetters(player.pick, player.validWords);
    // Written so an empty list yields +0 rather than -0.
    const draftPenalty = draftUnused.length === 0
      ? 0
      : -draftUnused.length * DRAFT_PENALTY_PER_UNUSED_LETTER;

    results.set(player.id, {
      id: player.id,
      name: player.name,
      teamName: player.teamName ?? null,
      wordPoints,
      baseScore: base,
      sameWordPenalty: 0,
      draftPenalty,
      draftUnused,
      bonuses: [],
      roundScore: base,
      validWordCount: player.validWords.length,
      uniqueWordCount: 0,
      wrongTries: player.wrongTries,
      totalTries: player.totalTries,
      accuracy:
        player.totalTries > 0 ? player.wrongTries / player.totalTries : null,
      longestWordAuthor: longestAuthor,
      bestWordAuthor: bestAuthor,
    });
  }

  const awardTracker = new AwardTracker(results, config);

  // --- Words shared by every player score zero for everyone ---
  const submitterCount = countSubmitters(players);
  for (const [word, ids] of submitterCount) {
    if (ids.length < 2 || ids.length !== players.length) continue;
    const points = scoreWord(word, input.letterValues);
    for (const id of ids) {
      const result = results.get(id);
      if (result) result.sameWordPenalty -= points;
    }
  }

  // --- Unique words: submitted by exactly one player ---
  const uniqueWords: UniqueWordReveal[] = [];
  for (const [word, ids] of submitterCount) {
    if (ids.length !== 1) continue;
    const ownerId = ids[0]!;
    const owner = results.get(ownerId);
    if (!owner) continue;

    const points = config.bonuses.uniqueWord;
    owner.bonuses.push({ stat: 'unique_word', points });
    owner.uniqueWordCount += 1;
    uniqueWords.push({
      word,
      playerId: ownerId,
      playerName: owner.name,
      points,
      credit: creditWithAuthor(owner, owner.name, wordAuthor(players, ownerId, word)),
    });
  }
  uniqueWords.sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word));

  awardTracker.awardHighest({
    stat: 'most_unique_words',
    label: 'Most unique words',
    points: config.bonuses.mostUniqueWords,
    valueOf: (result) => result.uniqueWordCount,
  });

  awardTracker.awardHighest({
    stat: 'most_created_words',
    label: 'Most created words',
    points: config.bonuses.mostCreatedWords,
    valueOf: (result) => result.validWordCount,
  });

  awardTracker.awardHighest({
    stat: 'longest_word',
    label: 'Longest word',
    points: config.bonuses.longestWord,
    valueOf: (result) => longestWordLength(result),
    authorOf: (result) => result.longestWordAuthor,
  });

  awardTracker.awardHighest({
    stat: 'most_point_words',
    label: 'Highest-scoring word',
    points: config.bonuses.mostPointWords,
    valueOf: (result) => bestWordScore(result),
    authorOf: (result) => result.bestWordAuthor,
  });

  awardBestAccuracy(players, results, config, awardTracker);

  // --- Highlight only: the word the most players used ---
  const mostUsedWords = findMostUsedWords(submitterCount);

  // --- Final round score: base, shared-word and draft penalties, plus bonuses ---
  const ordered = players.map((player) => results.get(player.id)!).filter(Boolean);
  const draftPenalties: DraftPenaltyEntry[] = [];
  for (const result of ordered) {
    const bonusTotal = result.bonuses.reduce((sum, bonus) => sum + bonus.points, 0);
    result.roundScore =
      result.baseScore + result.sameWordPenalty + result.draftPenalty + bonusTotal;
    if (result.draftPenalty < 0) {
      draftPenalties.push({
        id: result.id,
        label: result.teamName ?? result.name,
        unused: result.draftUnused,
        points: result.draftPenalty,
      });
    }
  }
  draftPenalties.sort((a, b) => a.points - b.points || a.label.localeCompare(b.label));

  return {
    players: ordered,
    uniqueWords,
    mostUsedWords,
    statAwards: awardTracker.completed(),
    draftPenalties,
  };
}

/** Letters this unit drafted that appear in none of its valid words. */
function unusedDraftedLetters(
  pick: readonly Letter[],
  validWords: readonly string[],
): Letter[] {
  const used = new Set<string>();
  for (const word of validWords) {
    for (const letter of word) used.add(letter);
  }
  const unused: Letter[] = [];
  for (const letter of new Set(pick)) {
    if (!used.has(letter)) unused.push(letter);
  }
  return unused;
}

function wordAuthor(
  players: readonly RoundPlayerInput[],
  id: PlayerId,
  word: string,
): string {
  const input = players.find((player) => player.id === id);
  return input?.wordAuthors?.[word] ?? input?.name ?? id;
}

/** "Alice", or "Team A · Alice" when the unit is a team and someone else found it. */
function creditWithAuthor(
  result: PlayerRoundResult,
  label: string,
  author: string,
): string {
  if (result.teamName && author !== label) return `${label} · ${author}`;
  return author;
}

function countSubmitters(players: readonly RoundPlayerInput[]): Map<string, PlayerId[]> {
  const map = new Map<string, PlayerId[]>();
  for (const player of players) {
    for (const word of player.validWords) {
      const ids = map.get(word);
      if (ids) ids.push(player.id);
      else map.set(word, [player.id]);
    }
  }
  return map;
}

/** A word only counts as "used" when at least two players submitted it. */
function findMostUsedWords(submitterCount: Map<string, PlayerId[]>): string[] {
  let best = 0;
  const words: string[] = [];
  for (const [word, ids] of submitterCount) {
    if (ids.length < 2) continue;
    if (ids.length > best) {
      best = ids.length;
      words.length = 0;
      words.push(word);
    } else if (ids.length === best) {
      words.push(word);
    }
  }
  return words.sort();
}

function longestWordLength(result: PlayerRoundResult): number {
  let longest = 0;
  for (const word of Object.keys(result.wordPoints)) {
    if (word.length > longest) longest = word.length;
  }
  return longest;
}

function bestWordScore(result: PlayerRoundResult): number {
  let best = 0;
  for (const points of Object.values(result.wordPoints)) {
    if (points > best) best = points;
  }
  return best;
}

interface AwardSpec<T> {
  stat: string;
  label: string;
  points: number;
  valueOf: (result: PlayerRoundResult) => T;
  /** Returns true when a higher value means a better result. Defaults to numeric >. */
  higherIsBetter?: (a: T, b: T) => boolean;
  /** The member who actually produced the value, for team attribution. */
  authorOf?: (result: PlayerRoundResult) => string | null;
}

class AwardTracker {
  private readonly awards: StatAward[] = [];

  constructor(
    private readonly results: Map<PlayerId, PlayerRoundResult>,
    private readonly config: ScoringConfig,
  ) {}

  completed(): StatAward[] {
    return this.awards;
  }

  /** Awards a stat to every player sharing the best value. */
  awardHighest<T extends number | string>(spec: AwardSpec<T>): StatAward | null {
    const entries = [...this.results.values()]
      .map((result) => ({ result, value: spec.valueOf(result) }))
      .filter((entry) => !isZeroValue(entry.value));

    if (entries.length === 0) return null;

    const compare = spec.higherIsBetter ?? ((a: T, b: T) => a > b);
    let best = entries[0]!.value;
    for (const entry of entries) {
      if (compare(entry.value, best)) best = entry.value;
    }

    const winners = entries
      .filter((entry) => entry.value === best)
      .map((entry) => entry.result.id);

    return this.record(spec, winners, best);
  }

  /**
   * Records a stat. A lone winner always gets the points. On a tie, sharing on
   * gives every tied player the full points; sharing off awards nobody,
   * because no single player won the stat outright.
   */
  record<T extends number | string>(
    spec: AwardSpec<T>,
    winners: PlayerId[],
    value: StatAward['value'],
  ): StatAward | null {
    if (winners.length === 0) return null;

    const shared = winners.length === 1 || this.config.sharePointsOnStatTies;
    const awardedTo = shared ? winners : [];

    for (const id of awardedTo) {
      const result = this.results.get(id);
      if (result) result.bonuses.push({ stat: spec.stat, points: spec.points });
    }

    const award: StatAward = {
      stat: spec.stat,
      label: spec.label,
      points: shared ? spec.points : 0,
      winners,
      value,
      credit: this.creditFor(winners, spec.authorOf),
    };
    this.awards.push(award);
    return award;
  }

  /** How the reviewers should read the winner out loud. */
  private creditFor(
    winners: PlayerId[],
    authorOf?: (result: PlayerRoundResult) => string | null,
  ): string {
    const labels = [...new Set(winners.map((id) => this.labelFor(id)))];
    const only = winners.length === 1 ? this.results.get(winners[0]!) : undefined;
    const author = only && authorOf ? authorOf(only) : null;
    if (author && labels.length === 1 && author !== labels[0]) {
      return `${labels[0]} · ${author}`;
    }
    return labels.join(', ');
  }

  private labelFor(id: PlayerId): string {
    const result = this.results.get(id);
    if (!result) return id;
    return result.teamName ?? result.name;
  }
}

function isZeroValue(value: number | string): boolean {
  return value === 0;
}

/**
 * Lowest `wrong / total` wins. Eligible only when a player has at least
 * `0.5 * (total valid words / player count)` valid words, and never eligible
 * with zero tries or zero valid words. Ties break on most valid words.
 */
function awardBestAccuracy(
  players: readonly RoundPlayerInput[],
  results: Map<PlayerId, PlayerRoundResult>,
  config: ScoringConfig,
  tracker: AwardTracker,
): void {
  const totalValid = players.reduce((sum, player) => sum + player.validWords.length, 0);
  if (players.length === 0 || totalValid === 0) return;

  const threshold = config.accuracyMinFractionOfAverage * (totalValid / players.length);

  const eligible = players.filter(
    (player) =>
      player.totalTries > 0 &&
      player.validWords.length > 0 &&
      player.validWords.length >= threshold,
  );
  if (eligible.length === 0) return;

  let bestAccuracy = Infinity;
  for (const player of eligible) {
    const accuracy = player.wrongTries / player.totalTries;
    if (accuracy < bestAccuracy) bestAccuracy = accuracy;
  }

  const accurate = eligible.filter(
    (player) => player.wrongTries / player.totalTries === bestAccuracy,
  );

  let mostValid = -Infinity;
  for (const player of accurate) {
    if (player.validWords.length > mostValid) mostValid = player.validWords.length;
  }

  const winners = accurate
    .filter((player) => player.validWords.length === mostValid)
    .map((player) => player.id);

  tracker.record(
    {
      stat: 'best_accuracy',
      label: 'Best accuracy',
      points: config.bonuses.bestAccuracy,
      valueOf: (result) => result.accuracy ?? 0,
    },
    winners,
    // Displayed verbatim by both clients, so it has to read as a real accuracy.
    `${Math.round((1 - bestAccuracy) * 1000) / 10}% correct`,
  );
}

export interface StandingEntry {
  id: PlayerId;
  name: string;
  score: number;
  totalValidWords: number;
}

/**
 * Final standings. Highest score wins; equal scores fall back to the higher
 * total of valid words; players still level share the win.
 */
export function sortStandings(entries: readonly StandingEntry[]): StandingEntry[] {
  return [...entries].sort(
    (a, b) => b.score - a.score || b.totalValidWords - a.totalValidWords || a.name.localeCompare(b.name),
  );
}

export interface WinnerView {
  /** All players sharing first place. */
  winners: StandingEntry[];
  shared: boolean;
}

export function determineWinners(entries: readonly StandingEntry[]): WinnerView {
  const sorted = sortStandings(entries);
  const top = sorted[0];
  if (!top) return { winners: [], shared: false };

  const winners = sorted.filter(
    (entry) =>
      entry.score === top.score && entry.totalValidWords === top.totalValidWords,
  );

  return { winners, shared: winners.length > 1 };
}
