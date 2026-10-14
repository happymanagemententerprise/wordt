export * from './config';
export * from './types';
export {
  scoreWord,
  countPick,
} from './letterValues';
export {
  computeLetterValues,
  buildPool,
  overlapLetters,
  rareLetterCandidates,
  drawSessionRareLetter,
  SCRABBLE_VALUES,
  isVowel,
  type BuiltPool,
  type Rng,
} from './letterPool';
export { validateWord, normalizeWord, defaultWordContext } from './validate';
export { HOW_TO_PLAY, type RulesSection } from './rules';
export { teamName, mergeTeam, lettersPerTeamMember, teamIdsForPlayerCount, validTeamId } from './teams';
export {
  CONSENT_STORAGE_KEY,
  getConsent,
  hasConsent,
  setConsent,
  resetConsent,
  subscribeConsent,
  isConsentPending,
  pendingConsentCount,
  loadConsentedScript,
  type ConsentDecision,
  type ConsentedScript,
} from './consent';
export {
  scoreRound,
  sortStandings,
  determineWinners,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
  type StandingEntry,
  type WinnerView,
} from './roundScore';