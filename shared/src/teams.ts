import { TEAM_LETTERS_TOTAL, TEAM_NAMES, type TeamId } from './config';
import type { Letter, RoundPlayerInput } from './types';

/** Display name for a team id, falling back to a readable guess. */
export function teamName(teamId: string): string {
  return TEAM_NAMES[teamId as TeamId] ?? `Team ${teamId}`;
}

/**
 * Merges the members of one team into a single scoring unit.
 *
 * Two teams then score exactly as two players would: the combined word list,
 * combined try counters, the union of their drafted letters, and each word
 * remembered to the member who actually found it.
 */
export function mergeTeam(
  teamId: string,
  members: readonly RoundPlayerInput[],
): RoundPlayerInput {
  const validWords: string[] = [];
  const wordAuthors: Record<string, string> = {};
  const seenWords = new Set<string>();
  const pick: Letter[] = [];
  const seenLetters = new Set<string>();
  let wrongTries = 0;
  let totalTries = 0;

  for (const member of members) {
    wrongTries += member.wrongTries;
    totalTries += member.totalTries;

    for (const letter of member.pick) {
      if (seenLetters.has(letter)) continue;
      seenLetters.add(letter);
      pick.push(letter);
    }

    for (const word of member.validWords) {
      if (seenWords.has(word)) continue;
      seenWords.add(word);
      validWords.push(word);
      wordAuthors[word] = member.wordAuthors?.[word] ?? member.name;
    }
  }

  const name = teamName(teamId);
  return {
    id: teamId,
    name,
    validWords,
    wrongTries,
    totalTries,
    pick,
    teamName: name,
    wordAuthors,
  };
}

/**
 * How many letters each member of a team drafts, so the team ends up with
 * `TEAM_LETTERS_TOTAL` letters between them. A solo member drafts the lot.
 */
export function lettersPerTeamMember(memberCount: number): number {
  return Math.max(1, Math.ceil(TEAM_LETTERS_TOTAL / Math.max(1, memberCount)));
}
