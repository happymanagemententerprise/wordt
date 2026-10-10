import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Append-only analytics log.
 *
 * Every event is one JSON object per line (JSONL). Each line is written to the
 * file (default `logs/events.jsonl`, relative to the server's working
 * directory) and mirrored to stdout so it also lands in Render's log viewer.
 *
 * The writers are fire-and-forget: `logEvent` never throws and never blocks the
 * game. Writes are queued so lines never interleave, and every failure is
 * reported to stderr and swallowed. The file path and the stdout mirror are
 * configured with `WORDT_LOG_FILE` and `WORDT_LOG_STDOUT` (see the README).
 *
 * The scoring engine in `shared/` stays pure — only the server logs.
 */

const TRUTHY_FALSE = /^(0|false|no|off)$/i;

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  return !TRUTHY_FALSE.test(raw.trim());
}

function stdoutEnabled(): boolean {
  return envBool('WORDT_LOG_STDOUT', true);
}

function logFilePath(): string {
  const raw = process.env.WORDT_LOG_FILE;
  if (raw != null && raw.trim() !== '') return raw;
  return join(process.cwd(), 'logs', 'events.jsonl');
}

/**
 * Serialises writes so many events in flight cannot interleave, and so a
 * failed write never breaks the ones after it. Never rejects.
 */
let queue: Promise<void> = Promise.resolve();

async function appendLine(file: string, line: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${line}\n`, 'utf8');
}

/**
 * Appends one analytics event. `data` carries the event fields plus the common
 * context (`gameId`, `roomCode`, `round`). Missing context is written as null.
 * This function never throws and never blocks the caller.
 */
export function logEvent(type: string, data: Record<string, unknown> = {}): void {
  let line: string;
  try {
    const { gameId, roomCode, round, ...rest } = data;
    line = JSON.stringify({
      ts: new Date().toISOString(),
      gameId: gameId ?? null,
      roomCode: roomCode ?? null,
      round: round ?? null,
      type,
      ...rest,
    });
  } catch (error) {
    console.error('[wordt] analytics could not serialise an event:', error);
    return;
  }

  if (stdoutEnabled()) console.log(line);

  const file = logFilePath();
  if (!file) return;

  queue = queue.then(() =>
    appendLine(file, line).catch((error: NodeJS.ErrnoException) => {
      console.error('[wordt] analytics write failed:', error.message);
    }),
  );
}

/** Resolves once every queued write has settled. Used by tests. */
export function flushAnalytics(): Promise<void> {
  return queue;
}
