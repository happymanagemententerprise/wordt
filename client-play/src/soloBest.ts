/** Personal best for solo practice, kept on this device only. */

export interface SoloBest {
  score: number;
  rounds: number;
  at: string;
}

const BEST_KEY = 'wordt.solo.best';

function isBest(value: unknown): value is SoloBest {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SoloBest>;
  return (
    typeof candidate.score === 'number' &&
    Number.isFinite(candidate.score) &&
    typeof candidate.rounds === 'number' &&
    Number.isFinite(candidate.rounds)
  );
}

export function loadSoloBest(): SoloBest | null {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isBest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves a finished practice game when it beats the stored best. */
export function recordSoloBest(
  score: number,
  rounds: number,
): { best: SoloBest; improved: boolean } {
  const previous = loadSoloBest();
  if (previous && previous.score >= score) return { best: previous, improved: false };

  const best: SoloBest = { score, rounds, at: new Date().toISOString() };
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch {
    // Private browsing or full storage: the result still shows for this session.
  }
  return { best, improved: true };
}
