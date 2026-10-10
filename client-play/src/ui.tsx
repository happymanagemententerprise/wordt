import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { formatRound, type LetterValueTable, type PublicPlayer } from '@wordt/shared';

/** Seconds remaining until the server ends the current phase. */
export function useCountdown(endsAt: number | null): number {
  const [left, setLeft] = useState(() =>
    endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (endsAt === null) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return left;
}

export function Countdown({ endsAt, hint }: { endsAt: number | null; hint?: string }): ReactNode {
  const seconds = useCountdown(endsAt);
  if (endsAt === null) return null;
  return (
    <div className={`countdown${seconds <= 5 ? ' countdown--urgent' : ''}`}>
      <span className="countdown__value">{seconds}</span>
      <span className="countdown__unit">{hint ?? 's'}</span>
    </div>
  );
}

export function PhasePill({ round, roundCount, phase }: { round: number; roundCount: number | null; phase: string }): ReactNode {
  return (
    <div className="pills">
      <span className="pill">{formatRound(round, roundCount)}</span>
      <span className="pill pill--phase">{phaseLabel(phase)}</span>
    </div>
  );
}

export function phaseLabel(phase: string): string {
  switch (phase) {
    case 'LOBBY':
      return 'Lobby';
    case 'PICKING':
      return 'Picking letters';
    case 'VALUE_TABLE':
      return 'Letter values';
    case 'WORDS':
      return 'Word making';
    case 'NOTICE':
      return 'Heads up';
    case 'REVIEW':
      return 'Round review';
    case 'RESULTS':
      return 'Round results';
    case 'GAME_OVER':
      return 'Final results';
    default:
      return phase;
  }
}

export function Standings({
  players,
  activeId,
  showStats = false,
  onMakeHost,
  onKick,
}: {
  players: PublicPlayer[];
  activeId?: string;
  showStats?: boolean;
  onMakeHost?: (playerId: string) => void;
  onKick?: (playerId: string) => void;
}): ReactNode {
  return (
    <ol className="standings">
      {players.map((player, index) => (
        <li
          key={player.id}
          style={{ '--i': index } as CSSProperties}
          className={`standing${player.id === activeId ? ' standing--you' : ''}${player.connected ? '' : ' standing--away'}`}
        >
          <span className="standing__rank">{index + 1}</span>
          <span className="standing__name">
            {player.name}
            {player.isHost ? <span className="tag tag--host">host</span> : null}
            {player.teamId && player.teamId !== player.id ? (
              <span className="tag tag--team">{player.teamId}</span>
            ) : null}
            {!player.connected ? <span className="tag tag--away">offline</span> : null}
          </span>
          {onMakeHost && !player.isHost && player.connected ? (
            <span className="standing__actions">
              <button
                className="make-host"
                type="button"
                aria-label={`Make ${player.name} host`}
                onClick={() => onMakeHost(player.id)}
              >
                Host
              </button>
            </span>
          ) : null}
          {onKick && player.id !== activeId ? (
            <span className="standing__actions">
              <button
                className="make-host make-host--kick"
                type="button"
                aria-label={`Remove ${player.name} from the room`}
                onClick={() => onKick(player.id)}
              >
                Remove
              </button>
            </span>
          ) : null}
          {showStats ? (
            <span className="standing__stats">
              {player.validWordCount} words · {player.totalTries} tries
            </span>
          ) : null}
          <span className="standing__score">{player.score}</span>
        </li>
      ))}
    </ol>
  );
}

export function ValueTable({ table }: { table: LetterValueTable }): ReactNode {
  if (table.entries.length === 0) {
    return <p className="empty">There are no usable letters this round.</p>;
  }
  return (
    <div className="value-table">
      {table.entries.map((entry, index) => {
        const added = table.source[entry.letter] === 'added';
        return (
          <div key={entry.letter} className="value-row" style={{ '--i': index } as CSSProperties}>
            <span className={`value-letter value-${Math.min(5, Math.max(1, entry.value))}`}>
              {entry.letter}
            </span>
            <span className="value-count">
              {added ? 'added by the computer' : `picked by ${entry.count}`}
            </span>
            <span className="value-points">{entry.value} pt</span>
          </div>
        );
      })}
    </div>
  );
}

export function LetterChips({ table }: { table: LetterValueTable }): ReactNode {
  return (
    <div className="chips">
      {table.entries.map((entry) => (
        <span key={entry.letter} className="chip">
          {entry.letter}
          <em>{entry.value}</em>
        </span>
      ))}
    </div>
  );
}
