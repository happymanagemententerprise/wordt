import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALLOW_LETTER_REUSE_IN_WORD, MIN_WORD_LENGTH } from './config';
import { computeLetterValues, countPick } from './letterValues';
import { validateWord } from './validate';
import type {
  Letter,
  LetterValueTable,
  ValidationResult,
  WordCheckContext,
} from './types';

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

export { computeLetterValues, countPick };
