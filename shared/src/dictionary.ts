import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALLOW_LETTER_REUSE_IN_WORD, MIN_WORD_LENGTH } from './config';
import { countPick, scoreWord } from './letterValues';
import { computeLetterValues } from './letterPool';
import { validateWord } from './validate';
import type {
  Letter,
  LetterValueTable,
  MissedWord,
  ValidationResult,
  WordCheckContext,
} from './types';
export { computeLetterValues, countPick };

const WORDS_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'words.txt');

let cached: Set<string> | null = null;

/** Loads the bundled English word list once and returns it upper-cased. */
export function loadDictionary(): ReadonlySet<string> {
  if (cached) return cached;
  const raw = readFileSync(WORDS_FILE, 'utf8');
  cached = new Set(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim().toUpperCase())
      .filter((line) => line.length > 0),
  );
  return cached;
}

export function buildWordContext(
  table: LetterValueTable,
  dictionary: ReadonlySet<string> = loadDictionary(),
): WordCheckContext {
  return {
    dictionary,
    usableLetters: new Set(table.entries.map((entry) => entry.letter)),
    letterCounts: table.counts,
    minLength: MIN_WORD_LENGTH,
    allowReuse: ALLOW_LETTER_REUSE_IN_WORD,
  };
}

export interface WordAttempt {
  result: ValidationResult;
  word: string;
  score: number;
}

/** Convenience wrapper so the server never touches validation internals. */
export function checkWordAttempt(
  rawWord: string,
  table: LetterValueTable,
  alreadySubmitted: ReadonlySet<string> = new Set(),
  dictionary: ReadonlySet<string> = loadDictionary(),
): WordAttempt {
  const word = rawWord.trim().toUpperCase();
  const result = validateWord(rawWord, buildWordContext(table, dictionary), alreadySubmitted);
  const score = result.ok
    ? [...word].reduce((sum, letter) => sum + (table.values[letter] ?? 0), 0)
    : 0;
  return { result, word, score };
}

/** How many words the end-of-round spotlight shows. */
export const SPOTLIGHT_WORDS_COUNT = 5;

/**
 * Finds the best words the pool could have made that no player submitted.
 * Scans the dictionary once per round (server-side only, where the word list
 * lives). Ranked by point value; ties fall back to length, then alphabetically.
 */
export function computeMissedWords(
  dictionary: ReadonlySet<string>,
  pool: ReadonlySet<Letter>,
  letterValues: Readonly<Record<Letter, number>>,
  submitted: ReadonlySet<string>,
  count = SPOTLIGHT_WORDS_COUNT,
): MissedWord[] {
  const scores: MissedWord[] = [];
  for (const word of dictionary) {
    if (word.length < MIN_WORD_LENGTH) continue;
    if (submitted.has(word)) continue;

    let ok = true;
    let points = 0;
    for (const letter of word) {
      if (!pool.has(letter)) {
        ok = false;
        break;
      }
      points += letterValues[letter] ?? 0;
    }
    if (!ok) continue;
    scores.push({ word, points });
  }

  scores.sort(
    (a, b) =>
      b.points - a.points ||
      b.word.length - a.word.length ||
      a.word.localeCompare(b.word),
  );
  return scores.slice(0, count);
}

/** Sums the point value of every letter in a word (re-export for convenience). */
export { scoreWord };