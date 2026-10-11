import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DefinitionsModule from '../src/definitions';

type Definitions = typeof DefinitionsModule;

let defs: Definitions;

const GOOD_PAYLOAD = {
  word: 'store',
  entries: [
    { partOfSpeech: '', senses: [{ definition: '   ' }, { definition: '' }] },
    {
      partOfSpeech: 'noun',
      senses: [
        { definition: 'A place where goods are sold.' },
        { definition: 'A supply kept for future use.' },
      ],
    },
  ],
  source: { url: 'https://example.test/store', license: 'CC BY-SA 4.0' },
};

function expectedMeaning(definition: string, partOfSpeech = 'noun') {
  return { partOfSpeech, definition };
}

beforeEach(async () => {
  vi.resetModules();
  // No disk cache in tests, and every lookup points at a fake host we control.
  vi.stubEnv('WORDT_DEFINITIONS_CACHE', 'false');
  vi.stubEnv('WORDT_DEFINITIONS_API', 'https://dict.test/entries/en');
  defs = await import('../src/definitions');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('truncateDefinition', () => {
  it('returns short definitions unchanged', () => {
    expect(defs.truncateDefinition('A place where goods are sold.')).toBe(
      'A place where goods are sold.',
    );
  });

  it('collapses whitespace', () => {
    expect(defs.truncateDefinition('  a   place \n where  goods are sold ')).toBe(
      'a place where goods are sold',
    );
  });

  it('cuts long definitions at a word boundary with an ellipsis', () => {
    const long = 'word '.repeat(50).trim();
    const cut = defs.truncateDefinition(long, 20);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(21);
    expect(cut).not.toContain('  ');
  });
});

describe('pickMeaning', () => {
  it('uses the first sense that has a definition', () => {
    expect(defs.pickMeaning(GOOD_PAYLOAD)).toEqual({
      partOfSpeech: 'noun',
      definition: 'A place where goods are sold.',
    });
  });

  it('returns null when there is nothing usable', () => {
    expect(defs.pickMeaning(null)).toBeNull();
    expect(defs.pickMeaning({})).toBeNull();
    expect(defs.pickMeaning({ entries: [] })).toBeNull();
    expect(
      defs.pickMeaning({ entries: [{ partOfSpeech: 'noun', senses: [{ definition: '   ' }] }] }),
    ).toBeNull();
  });

  it('tolerates a missing part of speech', () => {
    expect(
      defs.pickMeaning({ entries: [{ senses: [{ definition: 'To keep in store.' }] }] }),
    ).toEqual({ partOfSpeech: '', definition: 'To keep in store.' });
  });
});

describe('getDefinitions', () => {
  it('fetches each word and keys the result by upper-case word', async () => {
    const fetchMock = vi.fn(async () => response(200, GOOD_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);

    const result = await defs.getDefinitions(['store', 'store', 'stone']);

    expect(value(result, 'STORE')).toEqual({
      partOfSpeech: 'noun',
      definition: 'A place where goods are sold.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches successes so a word is fetched at most once', async () => {
    const fetchMock = vi.fn(async () => response(200, GOOD_PAYLOAD));
    vi.stubGlobal('fetch', fetchMock);

    await defs.getDefinitions(['store']);
    const second = await defs.getDefinitions(['STORE']);

    expect(value(second, 'STORE')?.definition).toBe('A place where goods are sold.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches a 404 as a stable "no definition"', async () => {
    const fetchMock = vi.fn(async () => response(404, { error: 'not found' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(value(await defs.getDefinitions(['zzz']), 'ZZZ')).toBeNull();
    expect(value(await defs.getDefinitions(['zzz']), 'ZZZ')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rate limit, so a later round retries', async () => {
    const fetchMock = vi.fn(async () => response(429, { error: 'slow down' }));
    vi.stubGlobal('fetch', fetchMock);

    expect(value(await defs.getDefinitions(['store']), 'STORE')).toBeNull();
    expect(value(await defs.getDefinitions(['store']), 'STORE')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a network failure', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(defs.getDefinitions(['store'])).resolves.toEqual({ STORE: null });
    expect(value(await defs.getDefinitions(['store']), 'STORE')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats malformed JSON as no definition and does not cache it', async () => {
    const fetchMock = vi.fn(async () => response(200, undefined, true));
    vi.stubGlobal('fetch', fetchMock);

    expect(value(await defs.getDefinitions(['store']), 'STORE')).toBeNull();
    expect(value(await defs.getDefinitions(['store']), 'STORE')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resolves with nulls instead of throwing when the dictionary is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );

    await expect(defs.getDefinitions(['store', 'stone'])).resolves.toEqual({
      STORE: null,
      STONE: null,
    });
  });

  it('gives up after the timeout and never blocks the reveal', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const pending = defs.getDefinitions(['store']);
    await vi.advanceTimersByTimeAsync(2000);
    const result = await pending;

    expect(value(result, 'STORE')).toBeNull();
    // A timeout is not cached; the next round can try again.
    const pending2 = defs.getDefinitions(['store']);
    await vi.advanceTimersByTimeAsync(2000);
    await pending2;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

function response(status: number, body: unknown, badJson = false): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (badJson) throw new SyntaxError('Unexpected token');
      return body;
    },
  } as unknown as Response;
}

function value(
  record: Record<string, { partOfSpeech: string; definition: string } | null>,
  key: string,
) {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}
