export type Letter = string;
export type PlayerId = string;
export type RoomCode = string;

export type Phase =
  | 'LOBBY'
  | 'PICKING'
  | 'VALUE_TABLE'
  | 'WORDS'
  | 'NOTICE'
  | 'REVIEW'
  | 'RESULTS'
  | 'GAME_OVER';

/** Reasons a submitted word can be rejected. DUPLICATE never counts as a wrong try. */
export type WordRejection =
  | 'NOT_IN_DICTIONARY'
  | 'UNUSABLE_LETTER'
  | 'TOO_SHORT'
  | 'DUPLICATE';

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: WordRejection };

export interface LetterValueEntry {
  letter: Letter;
  count: number;
  value: number;
}

export interface LetterValueTable {
  /** Usable letters only (count >= USABLE_MIN_COUNT), sorted best rank first. */
  entries: LetterValueEntry[];
  /** Quick lookup: letter -> value. */
  values: Record<Letter, number>;
  /** Letter -> pick count, usable letters only. */
  counts: Record<Letter, number>;
}

export interface WordCheckContext {
  dictionary: ReadonlySet<string>;
  usableLetters: ReadonlySet<string>;
  minLength: number;
  allowReuse: boolean;
  /** How many players picked each letter. Only consulted when reuse is disabled. */
  letterCounts?: Readonly<Record<Letter, number>>;
}

export interface AcceptedWord {
  word: string;
  score: number;
}

/** A player's contribution to one round's scoring. Words are already validated. */
export interface RoundPlayerInput {
  id: PlayerId;
  name: string;
  validWords: string[];
  wrongTries: number;
  totalTries: number;
}

export type RoundScoreInput = {
  players: RoundPlayerInput[];
  letterValues: Record<Letter, number>;
};

export interface StatAward {
  /** Machine readable id, e.g. 'most_unique_words'. */
  stat: string;
  /** Human readable label for the TV review. */
  label: string;
  points: number;
  /** Every player that receives the points (more than one on a shared tie). */
  winners: PlayerId[];
  /** The value that was achieved, for display. */
  value: number | string;
}

export interface PlayerRoundResult {
  id: PlayerId;
  name: string;
  /** word -> points earned by that word, before penalties/bonuses. */
  wordPoints: Record<string, number>;
  baseScore: number;
  sameWordPenalty: number;
  bonuses: { stat: string; points: number }[];
  roundScore: number;
  validWordCount: number;
  uniqueWordCount: number;
  wrongTries: number;
  totalTries: number;
  /** wrong / total, or null when the player had no tries. */
  accuracy: number | null;
}

export interface UniqueWordReveal {
  word: string;
  playerId: PlayerId;
  playerName: string;
  points: number;
}

export interface RoundResult {
  players: PlayerRoundResult[];
  /** Words submitted by exactly one player. */
  uniqueWords: UniqueWordReveal[];
  /** Words submitted by the most players (only when submitted by 2+ players). */
  mostUsedWords: string[];
  statAwards: StatAward[];
}

/** One player's live record in a room. */
export interface RoomPlayer {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Letters picked so far this round. */
  pick: Letter[];
  pickedLocked: boolean;
  /** Server-tracked submission counters for this round. */
  validWords: string[];
  wrongTries: number;
  totalTries: number;
  /** Cumulative score across rounds. */
  score: number;
  /** Cumulative valid word count across rounds, used for the final tie-break. */
  lifetimeValidWords: number;
  joinedAt: number;
}

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  connected: boolean;
  score: number;
  pickCount: number;
  pickedLocked: boolean;
  validWordCount: number;
  wrongTries: number;
  totalTries: number;
  isHost: boolean;
}

export interface PublicRoomState {
  roomCode: RoomCode;
  phase: Phase;
  round: number;
  roundCount: number;
  phaseEndsAt: number | null;
  players: PublicPlayer[];
  hostId: PlayerId | null;
  /** Present from VALUE_TABLE onwards. */
  letterValues: LetterValueTable | null;
  /** Present from WORDS onwards: how many usable letters exist. */
  usableLetterCount: number;
  minWordLength: number;
  pickLimit: number;
  timers: { pick: number; word: number };
  lastRoundResult: RoundResult | null;
  finalStandings: PublicPlayer[] | null;
  notice: string | null;
}

/** Everything a phone client is allowed to see about its own seat. */
export interface OwnState {
  id: PlayerId;
  name: string;
  isHost: boolean;
  pick: Letter[];
  pickLimit: number;
  pickedLocked: boolean;
  words: string[];
  wordScores: Record<string, number>;
  wrongTries: number;
  totalTries: number;
  score: number;
}

export interface JoinRequest {
  roomCode: RoomCode;
  name: string;
  playerId?: PlayerId;
}

export interface JoinAck {
  ok: boolean;
  error?: string;
  playerId?: PlayerId;
  roomCode?: RoomCode;
}
