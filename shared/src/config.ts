/** All tunable game rules live here. Nothing else should hard-code a rule constant. */

// --- Phase timers (seconds) ---
export const PICK_PHASE_SECONDS = 30;
export const WORD_PHASE_SECONDS = 120;
export const ROUNDS = 3;

// --- Word rules ---
export const MIN_WORD_LENGTH = 3;
export const ALLOW_LETTER_REUSE_IN_WORD = true;

// --- Scoring ---
export const SHARE_POINTS_ON_STAT_TIES = true;

// --- Picking ---
export const LETTER_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' as const;
export const LETTERS_PER_PLAYER_TWO = 15;
export const LETTERS_PER_PLAYER_MORE = 10;
/** A letter enters the usable pool only when at least this many players picked it. */
export const USABLE_MIN_COUNT = 2;
/** Possible letter values, split over the usable letters. */
export const VALUE_MIN = 1;
export const VALUE_MAX = 5;

// --- Draft penalty ---
/** Points lost for every letter a player drafted that appears in none of
 *  their valid words. Drafting letters you never play is meant to cost you. */
export const DRAFT_PENALTY_PER_UNUSED_LETTER = 1;

// --- Teams ---
/** Two teams, this many players on each. */
export const TEAM_MAX_PLAYERS = 2;
/** Letters a whole team drafts between them; split across its members. */
export const TEAM_LETTERS_TOTAL = 10;
export const TEAM_IDS = ['A', 'B'] as const;
export type TeamId = (typeof TEAM_IDS)[number];
export const TEAM_NAMES: Readonly<Record<TeamId, string>> = { A: 'Team A', B: 'Team B' };

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
