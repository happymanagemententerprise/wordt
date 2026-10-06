import { ALLOW_LETTER_REUSE_IN_WORD, MIN_WORD_LENGTH } from './config';
import type { ValidationResult, WordCheckContext } from './types';

/**
 * Pure word check. The caller decides what a rejection costs.
 *
 * Check order matters because a word can break several rules at once:
 * length, then letter availability, then duplicate, then dictionary membership.
 */
export function validateWord(
  rawWord: string,
  context: WordCheckContext,
  alreadySubmitted: ReadonlySet<string> = new Set(),
): ValidationResult {
  const word = normalizeWord(rawWord);

  if (word.length < context.minLength) return { ok: false, reason: 'TOO_SHORT' };

  if (!meetsLetterAvailability(word, context)) {
    return { ok: false, reason: 'UNUSABLE_LETTER' };
  }

  if (alreadySubmitted.has(word)) return { ok: false, reason: 'DUPLICATE' };

  if (!context.dictionary.has(word)) return { ok: false, reason: 'NOT_IN_DICTIONARY' };

  return { ok: true };
}

/**
 * Every letter must be usable. With reuse disabled a letter may also appear at
 * most `count` times, where `count` is how many players picked it.
 */
function meetsLetterAvailability(word: string, context: WordCheckContext): boolean {
  const seen = new Map<string, number>();

  for (const letter of word) {
    if (!context.usableLetters.has(letter)) return false;
    if (context.allowReuse) continue;

    const used = (seen.get(letter) ?? 0) + 1;
    seen.set(letter, used);

    const available = context.letterCounts?.[letter] ?? 1;
    if (used > available) return false;
  }

  return true;
}

/** Normalises a word the same way `validateWord` does, for storage and display. */
export function normalizeWord(rawWord: string): string {
  return rawWord.trim().toUpperCase();
}

/** Defaults used by tests and as a fallback when a caller passes no context. */
export const defaultWordContext: Pick<
  WordCheckContext,
  'minLength' | 'allowReuse'
> = {
  minLength: MIN_WORD_LENGTH,
  allowReuse: ALLOW_LETTER_REUSE_IN_WORD,
};
