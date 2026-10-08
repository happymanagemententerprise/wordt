/** All tunable game rules live here. Nothing else should hard-code a rule constant. */

// --- Phase timers (seconds) ---
export const PICK_PHASE_SECONDS = 30;
export const WORD_PHASE_SECONDS = 120;
export const ROUNDS = 3;
/** The host chooses the word-phase length before every game. */
export const ROUND_SECONDS_MIN = 10;
export const ROUND_SECONDS_MAX = 600;
/** Suggested word-phase lengths offered in the lobby. */
export const ROUND_SECONDS_CHOICES = [30, 60, 90, 120] as const;

// --- Word rules ---
export const MIN_WORD_LENGTH = 3;
export const ALLOW_LETTER_REUSE_IN_WORD = true;

// --- Rare letter ---
/** The rare letter is drawn by the computer, outside the round's pool. */
export const RARE_LETTER_SOURCE = 'computer';
/** Points earned for finding the rare letter. A tie between finders credits nobody. */
export const RARE_LETTER_VALUE = 10;

// --- Letter pool ---
export const LETTER_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;
/** The computer tops the overlap letters up to this many per round. */
export const POOL_SIZE = 15;
export const LETTERS_PER_PLAYER_TWO = 15;
export const LETTERS_PER_PLAYER_MORE = 10;
/** A letter enters the overlap pool only when at least this many players picked it. */
export const USABLE_MIN_COUNT = 2;
/** The letters that are never computer-added and always worth their overlap tier. */
export const VOWELS = 'AEIOU';
/** Player-overlap consonants spread over this many value tiers (1..CONSONANT_TIERS). */
export const CONSONANT_TIERS = 5;
/** Player-overlap vowels spread over this many tiers, so vowels stay cheap. */
export const VOWEL_TIERS = 2;
export const VALUE_MIN = 1;
export const VALUE_MAX = CONSONANT_TIERS;

// --- Draft penalty ---
/** Points lost for every letter a player drafted that appears in none of
 *  their valid words. Drafting letters you never play is meant to cost you. */
export const DRAFT_PENALTY_PER_UNUSED_LETTER = 1;

// --- Teams ---
/** A team is exactly this many players. The game splits into `ceil(n / 2)`
 *  teams, up to this many. */
export const TEAM_SIZE = 2;
export const MAX_TEAMS = 4;
/** Rooms hold at most this many players ("8 players, 4 teams of 2"). */
export const MAX_PLAYERS = 8;
/** Letters a whole team drafts between them; split across its members. */
export const TEAM_LETTERS_TOTAL = 10;
export const TEAM_NAMES: Readonly<Record<string, string>> = {
  A: 'Team A',
  B: 'Team B',
  C: 'Team C',
  D: 'Team D',
};

// --- Round bonuses ---
export const BONUS_UNIQUE_WORD = 2;
export const BONUS_MOST_UNIQUE_WORDS = 2;
export const BONUS_MOST_CREATED_WORDS = 2;
export const BONUS_LONGEST_WORD = 2;
export const BONUS_MOST_POINT_WORDS = 2;
export const BONUS_BEST_ACCURACY = 1;
/** A player must have at least this fraction of the per-player average of valid words
 *  to be eligible for Best Accuracy. */
export const ACCURACY_MIN_FRACTION_OF_AVERAGE = 0.5;
/** When several units tie for a stat, the award's points split evenly among them. */
export const SHARE_POINTS_ON_STAT_TIES = true;

// --- Server-only presentation timings, not part of the game rules ---
/** How long the letter value table stays on screen before the word phase begins. */
export const VALUE_REVEAL_SECONDS = 8;
/** How long each step of the end-of-round result review stays on screen. */
export const REVIEW_STEP_SECONDS = 6;

/**
 * Fixed English frequency order used to break ties when letters have equal pick
 * counts. More common letters sort earlier, therefore get the lower value.
 */
export const ENGLISH_FREQUENCY_ORDER = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';