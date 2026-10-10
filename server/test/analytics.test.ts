import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushAnalytics, logEvent } from '../src/analytics';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(`${tmpdir()}\\wordt-analytics-`);
  vi.stubEnv('WORDT_LOG_STDOUT', 'false');
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe('logEvent', () => {
  it('appends valid JSONL with the shared context fields', async () => {
    const file = join(dir, 'events.jsonl');
    vi.stubEnv('WORDT_LOG_FILE', file);

    logEvent('game_start', {
      gameId: 'g1',
      roomCode: 'ABCDE',
      round: null,
      playerCount: 2,
      teamMode: false,
      roundSeconds: 60,
    });
    logEvent('word_submitted', {
      gameId: 'g1',
      roomCode: 'ABCDE',
      round: 1,
      playerId: 'p1',
      word: 'STORE',
      valid: true,
      countsAsWrongTry: false,
      points: 5,
      msIntoRound: 1234,
    });
    await flushAnalytics();

    const lines = (await readFile(join(dir, 'events.jsonl'), 'utf8'))
      .split('\n')
      .filter((line) => line.trim() !== '');

    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]!);
    expect(first.type).toBe('game_start');
    expect(typeof first.ts).toBe('string');
    expect(Number.isNaN(Date.parse(first.ts))).toBe(false);
    expect(first.gameId).toBe('g1');
    expect(first.roomCode).toBe('ABCDE');
    expect(first.round).toBeNull();
    expect(first.playerCount).toBe(2);
    expect(first.teamMode).toBe(false);

    const second = JSON.parse(lines[1]!);
    expect(second.type).toBe('word_submitted');
    expect(second.gameId).toBe('g1');
    expect(second.round).toBe(1);
    expect(second.playerId).toBe('p1');
    expect(second.word).toBe('STORE');
    expect(second.valid).toBe(true);
    expect(second.points).toBe(5);
  });

  it('does not throw and does not block when the path is unwritable', async () => {
    const blocker = join(dir, 'blocker');
    await writeFile(blocker, 'not a directory');
    const badPath = join(blocker, 'events.jsonl');
    vi.stubEnv('WORDT_LOG_FILE', badPath);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => logEvent('game_start', {})).not.toThrow();
    await expect(flushAnalytics()).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();

    // A later valid write still succeeds after the failed one.
    vi.stubEnv('WORDT_LOG_FILE', join(dir, 'ok.jsonl'));
    logEvent('game_over', {});
    await flushAnalytics();
    const okLines = (await readFile(join(dir, 'ok.jsonl'), 'utf8')).split('\n').filter((l) => l.trim() !== '');
    expect(okLines).toHaveLength(1);
    expect(JSON.parse(okLines[0]!).type).toBe('game_over');
  });
});
