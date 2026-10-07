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
  /** The full pool (overlap + computer top-up), best value first. */
  entries: LetterValueEntry[];
  /** Quick lookup: letter -> value. */
  values: Record<Letter, number>;
  /** Letter -> pick count; 0 for computer-added letters. */
  counts: Record<Letter, number>;
  /** Where each letter came from, for the value table presentation. */
  source: Record<Letter, 'overlap' | 'added'>;
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

/** A player's contribution to one round's scoring. Words are already validated.
 *  In team mode the two teammates are merged into a single unit before scoring,
 *  so a team competes exactly like one player would. */
export interface RoundPlayerInput {
  id: PlayerId;
  name: string;
  validWords: string[];
  wrongTries: number;
  totalTries: number;
  /** Letters this unit drafted, used to work out the draft penalty. */
  pick: Letter[];
  /** Team name when this unit is a merged team; null for free-for-all play. */
  teamName?: string | null;
  /** word -> the member who found it, so a merged team still credits a person. */
  wordAuthors?: Record<string, string>;
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
  /** Who to credit on screen: "Alice", or "Team A · Alice" when teams are on. */
  credit: string;
}

export interface PlayerRoundResult {
  id: PlayerId;
  name: string;
  /** Team name for a merged team unit, otherwise null. */
  teamName: string | null;
  /** word -> points earned by that word, before penalties/bonuses. */
  wordPoints: Record<string, number>;
  baseScore: number;
  sameWordPenalty: number;
  /** Negative: one point for every drafted letter this unit never used. */
  draftPenalty: number;
  /** The drafted letters that never made it into a word. */
  draftUnused: Letter[];
  bonuses: { stat: string; points: number }[];
  roundScore: number;
  validWordCount: number;
  uniqueWordCount: number;
  wrongTries: number;
  totalTries: number;
  /** wrong / total, or null when the player had no tries. */
  accuracy: number | null;
  /** Member who wrote the longest word, for team attribution. */
  longestWordAuthor: string | null;
  /** Member who wrote the highest-scoring word, for team attribution. */
  bestWordAuthor: string | null;
}

export interface UniqueWordReveal {
  word: string;
  playerId: PlayerId;
  playerName: string;
  points: number;
  /** "Alice" or "Team A · Alice". */
  credit: string;
}

/** One unit's share of the draft penalty, revealed before the leaderboard. */
export interface DraftPenaltyEntry {
  id: PlayerId;
  /** "Alice" or "Team A". */
  label: string;
  /** Letters drafted that appear in none of this unit's valid words. */
  unused: Letter[];
  /** Always negative or zero. */
  points: number;
}

/** A word nobody submitted that the pool could have made, for the reveal. */
export interface MissedWord {
  word: string;
  points: number;
}

export interface RoundResult {
  players: PlayerRoundResult[];
  /** Words submitted by exactly one player. */
  uniqueWords: UniqueWordReveal[];
  /** Words submitted by the most players (only when submitted by 2+ players). */
  mostUsedWords: string[];
  statAwards: StatAward[];
  /** Only the units that actually lost points to the draft penalty. */
  draftPenalties: DraftPenaltyEntry[];
  /** Best words formable from the pool that nobody submitted; server-filled. */
  missedWords?: MissedWord[];
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

/** One step of the end-of-round result review, revealed on the TV in order. */
export type ReviewStep =
  | { kind: 'unique_word'; word: string; playerId: PlayerId; playerName: string; points: number; credit: string }
  | { kind: 'most_used_word'; words: string[] }
  | { kind: 'stat'; award: StatAward }
  | { kind: 'draft_penalty'; entries: DraftPenaltyEntry[] }
  | { kind: 'missed_words'; words: MissedWord[] }
  | { kind: 'leaderboard' };

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
  /** Team this player belongs to, or null in free-for-all play. */
  teamId: string | null;
  /** How many letters this player may pick this round (varies on teams). */
  pickLimit: number;
  /** Letters picked so far this round; shared so teammates do not double up. */
  pick: Letter[];
}

/** A team as one competitor: the standings row shown when teams are on. */
export interface PublicTeam {
  id: string;
  name: string;
  score: number;
  memberIds: PlayerId[];
  connected: boolean;
  validWordCount: number;
  wrongTries: number;
  totalTries: number;
  isHost: boolean;
}

/** A word accepted during the word phase, pushed live to the TV. */
export interface FeedItem {
  word: string;
  playerId: PlayerId;
  playerName: string;
  teamName: string | null;
  score: number;
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
  /** Present from VALUE_TABLE onwards: the fixed pool size. */
  usableLetterCount: number;
  minWordLength: number;
  pickLimit: number;
  timers: { pick: number; word: number };
  /** The word-phase length the host chose, or null before they pick one. */
  roundSeconds: number | null;
  /** Maximum number of players a room accepts. */
  maxPlayers: number;
  lastRoundResult: RoundResult | null;
  finalStandings: PublicPlayer[] | null;
  notice: string | null;
  /** Only populated during REVIEW. */
  reviewSteps: ReviewStep[];
  reviewIndex: number;
  /** Team play. */
  teamsEnabled: boolean;
  teams: PublicTeam[] | null;
  /** Who is leading: team rows when teams are on, otherwise the players. */
  standings: PublicPlayer[];
  /** Most recent accepted words, newest last. */
  feed: FeedItem[];
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
  teamId: string | null;
  teamName: string | null;
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
