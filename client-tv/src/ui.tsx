import { useEffect, useState, type ReactNode } from 'react';

import type { LetterValueTable, Phase, PublicPlayer } from '@wordt/shared';

function secondsLeft(endsAt: number | null): number | null {
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
}

export function useCountdown(endsAt: number | null): number | null {
  const [seconds, setSeconds] = useState(() => secondsLeft(endsAt));

  useEffect(() => {
    setSeconds(secondsLeft(endsAt));
    if (endsAt === null) return;
    const timer = setInterval(() => setSeconds(secondsLeft(endsAt)), 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  return seconds;
}

export function Countdown({ endsAt, hint }: { endsAt: number | null; hint?: string }): ReactNode {
  const seconds = useCountdown(endsAt);
  if (seconds === null) return null;
  return (
    <div className={`tv-countdown${seconds <= 5 ? ' tv-countdown--urgent' : ''}`}>
      <span className="tv-countdown__value">{seconds}</span>
      <span className="tv-countdown__unit">{hint ?? 's'}</span>
    </div>
  );
}

const PHASE_LABELS: Record<Phase, string> = {
  LOBBY: 'Lobby',
  PICKING: 'Pick letters',
  VALUE_TABLE: 'Letter values',
  WORDS: 'Make words',
  NOTICE: 'Heads up',
  REVIEW: 'Review',
  RESULTS: 'Round results',
  GAME_OVER: 'Final results',
};

export function phaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function Standings({
  players,
  teamLabel,
  showStats = false,
}: {
  players: PublicPlayer[];
  /** For a team row ("A"/"B"), the names of its members. */
  teamLabel?: (id: string) => string | null;
  showStats?: boolean;
}): ReactNode {
  return (
    <ol className="tv-standings">
      {players.map((player, index) => {
        const isTeam = player.teamId === player.id;
        const members = isTeam && teamLabel ? teamLabel(player.id) : null;
        return (
          <li
            key={player.id}
            className={`tv-standing${isTeam ? ` tv-team--${player.teamId}` : ''}`}
          >
            <span className="tv-standing__rank">{index + 1}</span>
            <span className="tv-standing__name">
              {player.name}
              {player.isHost ? <span className="tv-tag">host</span> : null}
              {!player.connected ? <span className="tv-tag tv-tag--away">offline</span> : null}
              {members ? <span className="tv-standing__members">{members}</span> : null}
            </span>
            {showStats ? (
              <span className="tv-standing__stats">
                {player.validWordCount} words · {player.totalTries - player.wrongTries}/{player.totalTries || 0} correct
              </span>
            ) : null}
            <span className="tv-standing__score">{player.score}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ValueTable({ table }: { table: LetterValueTable }): ReactNode {
  if (table.entries.length === 0) {
    return <p className="tv-empty">No letter was picked twice, so there is nothing to score with.</p>;
  }
  return (
    <div className="tv-values">
      {table.entries.map((entry) => (
        <div key={entry.letter} className="tv-value">
          <span className={`tv-value__letter lv-${Math.min(5, Math.max(1, entry.value))}`}>{entry.letter}</span>
          <span className="tv-value__count">{entry.count} picked</span>
          <span className="tv-value__points">{entry.value} pt</span>
        </div>
      ))}
    </div>
  );
}
