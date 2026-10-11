import { mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { WordMeaning } from '@wordt/shared';

/**
 * Server-side word definitions for the end-of-round spotlight.
 *
 * Only the five spotlight words of a round are ever looked up, and only ever
 * from the server — the phone and TV clients render whatever meaning the server
 * already attached. Every lookup is best-effort: a missing, slow or rejected
 * definition just leaves that word without a meaning, and the reveal keeps its
 * normal timing.
 *
 * A module-level cache (shared by every room and round) means a word is fetched
 * at most once per process. Successes and definitive "no definition" answers
 * are cached; timeouts, network errors and rate limits are not, so a later
 * round can try again. Definitions come from the English Wiktionary via
 * FreeDictionaryAPI.com and are used under CC BY-SA 4.0.
 */

const DEFAULT_API = 'https://freedictionaryapi.com/api/v1/entries/en';
/** Hard ceiling per request: the reveal must never wait on the dictionary. */
const REQUEST_TIMEOUT_MS = 2000;
/** Definitions are trimmed to roughly this many characters for the spotlight. */
const DEFINITION_MAX_CHARS = 120;

function apiBase(): string {
  const raw = process.env.WORDT_DEFINITIONS_API;
  return raw != null && raw.trim() !== '' ? raw.trim().replace(/\/$/, '') : DEFAULT_API;
}

const TRUTHY_FALSE = /^(0|false|no|off)$/i;

/** Cache persistence is a bonus; it can be turned off or pointed at a file. */
function cacheFilePath(): string | null {
  const raw = process.env.WORDT_DEFINITIONS_CACHE;
  if (raw != null && TRUTHY_FALSE.test(raw.trim())) return null;
  if (raw != null && raw.trim() !== '') return raw.trim();
  return join(process.cwd(), 'data', 'definitions-cache.json');
}

const cache = new Map<string, WordMeaning | null>();
let loadedFromDisk = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;

interface Lookup {
  /** False when the answer was a timeout, network error or rate limit. */
  cacheable: boolean;
  meaning: WordMeaning | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Trims a definition, collapses whitespace, and cuts it to a readable length at
 * a word boundary with an ellipsis. Exported so it can be unit-tested directly.
 */
export function truncateDefinition(text: string, max = DEFINITION_MAX_CHARS): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > 0) cut = cut.slice(0, lastSpace);
  cut = cut.replace(/[\s.,;:!?\-–—"')\]]+$/u, '').trimEnd();
  return `${cut}…`;
}

/**
 * Picks the meaning to show: the first sense with a non-empty definition from
 * the first entry that has one. Returns null when the payload carries nothing
 * usable. Exported so the sense-picking rule can be unit-tested directly.
 */
export function pickMeaning(payload: unknown): WordMeaning | null {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) return null;

  for (const entry of payload.entries) {
    if (!isRecord(entry)) continue;
    const partOfSpeech = typeof entry.partOfSpeech === 'string' ? entry.partOfSpeech.trim() : '';
    const senses = Array.isArray(entry.senses) ? entry.senses : [];
    for (const sense of senses) {
      if (!isRecord(sense)) continue;
      const raw = typeof sense.definition === 'string' ? sense.definition : '';
      const definition = truncateDefinition(raw);
      if (definition !== '') return { partOfSpeech, definition };
    }
  }
  return null;
}

function warn(word: string, reason: string): void {
  console.warn(`[definitions] ${word}: ${reason}`);
}

function loadCacheFromDisk(): void {
  if (loadedFromDisk) return;
  loadedFromDisk = true;
  const file = cacheFilePath();
  if (!file) return;
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null) return;
    for (const [word, value] of Object.entries(parsed)) {
      if (
        value === null ||
        (typeof value === 'object' &&
          typeof (value as WordMeaning).partOfSpeech === 'string' &&
          typeof (value as WordMeaning).definition === 'string')
      ) {
        cache.set(word.toUpperCase(), (value as WordMeaning | null) ?? null);
      }
    }
  } catch {
    /* No cache file yet, or unreadable: start empty. */
  }
}

function schedulePersist(): void {
  if (persistTimer || cacheFilePath() === null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void writeCache();
  }, 500);
  if (typeof persistTimer.unref === 'function') persistTimer.unref();
}

async function writeCache(): Promise<void> {
  const file = cacheFilePath();
  if (!file) return;
  try {
    const flat: Record<string, WordMeaning | null> = {};
    for (const [word, meaning] of cache) flat[word] = meaning;
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(flat, null, 2)}\n`, 'utf8');
  } catch {
    /* Persistence is a bonus; a failure must never affect the game. */
  }
}

/** One lookup, never rejects. Decides whether the answer is worth caching. */
async function lookupWord(word: string): Promise<Lookup> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase()}/${encodeURIComponent(word.toLowerCase())}`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    // A known "no definition" answer is stable, so it is safe to cache.
    if (response.status === 404) return { cacheable: true, meaning: null };
    if (!response.ok) {
      warn(word, `HTTP ${response.status}`);
      return { cacheable: false, meaning: null };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      warn(word, 'malformed JSON');
      return { cacheable: false, meaning: null };
    }
    return { cacheable: true, meaning: pickMeaning(payload) };
  } catch (error) {
    if (controller.signal.aborted) warn(word, 'timed out');
    else warn(word, error instanceof Error ? error.message : 'network error');
    return { cacheable: false, meaning: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Looks up a short meaning for each word, in parallel, with a hard per-request
 * timeout. Returns a plain record keyed by the upper-cased word; a word with no
 * usable meaning maps to null. Never throws and never waits longer than the
 * timeout, so the caller can fire it and treat a missing meaning as normal.
 */
export async function getDefinitions(words: string[]): Promise<Record<string, WordMeaning | null>> {
  loadCacheFromDisk();

  const keys: string[] = [];
  for (const raw of words) {
    const key = raw.trim().toUpperCase();
    if (key !== '' && !keys.includes(key)) keys.push(key);
  }

  const record: Record<string, WordMeaning | null> = {};
  const toFetch: string[] = [];
  for (const key of keys) {
    if (cache.has(key)) record[key] = cache.get(key) ?? null;
    else toFetch.push(key);
  }

  const settled = await Promise.allSettled(toFetch.map((word) => lookupWord(word)));
  settled.forEach((outcome, index) => {
    const word = toFetch[index]!;
    if (outcome.status !== 'fulfilled') {
      record[word] = null;
      return;
    }
    if (outcome.value.cacheable) {
      cache.set(word, outcome.value.meaning);
      schedulePersist();
    }
    record[word] = outcome.value.meaning;
  });

  return record;
}
