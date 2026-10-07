import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import type { LetterValueTable, Phase, PublicPlayer, PublicRoomState } from '@wordt/shared';

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

/** Big semi-transparent clock for the corner of the TV while a phase runs. */
export function TimeWatermark({ state }: { state: PublicRoomState }): ReactNode {
  const seconds = useCountdown(state.phaseEndsAt);
  if (seconds === null) return null;
  const clock = seconds >= 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : String(seconds);
  return (
    <div className={`tv-watermark${seconds <= 10 ? ' tv-watermark--urgent' : ''}`} aria-hidden="true">
      <span className="tv-watermark__value">{clock}</span>
      <span className="tv-watermark__unit">left</span>
    </div>
  );
}

export function Crown({ podium = false }: { podium?: boolean }): ReactNode {
  return (
    <svg className={`tv-crown${podium ? ' tv-crown--big' : ''}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 7.6 7 12l5-7.6 5 7.6 4.5-4.4-1.9 11.3H4.4L2.5 7.6Z" />
    </svg>
  );
}

/** Split battle bar showing each team's live share of the total score. */
export function WarBar({ state }: { state: PublicRoomState }): ReactNode {
  const teams = state.teams ?? [];
  if (!state.teamsEnabled || teams.length < 2) return null;

  const total = teams.reduce((sum, team) => sum + team.score, 0);
  return (
    <div className="tv-warbar" aria-label="Team scores">
      <div className="tv-warbar__labels">
        {teams.map((team) => (
          <span key={team.id} className={`tv-warbar__label tv-team-text--${team.id}`}>
            {team.name}
            <b key={team.score} className="tv-warbar__score">
              {team.score}
            </b>
          </span>
        ))}
      </div>
      <div className="tv-warbar__track">
        {teams.map((team) => (
          <span
            key={team.id}
            className={`tv-warbar__seg tv-warbar__seg--${team.id}`}
            style={{ width: `${total === 0 ? 100 / teams.length : (team.score / total) * 100}%` }}
          />
        ))}
      </div>
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
  rankChange,
}: {
  players: PublicPlayer[];
  /** For a team row ("A"/"B"), the names of its members. */
  teamLabel?: (id: string) => string | null;
  showStats?: boolean;
  /** Rank movement since the last round, keyed by row id. */
  rankChange?: Map<string, number>;
}): ReactNode {
  return (
    <ol className="tv-standings">
      {players.map((player, index) => {
        const isTeam = player.teamId === player.id;
        const members = isTeam && teamLabel ? teamLabel(player.id) : null;
        const move = rankChange?.get(player.id) ?? 0;
        return (
          <li
            key={player.id}
            style={{ '--i': index } as CSSProperties}
            className={`tv-standing${index === 0 ? ' tv-standing--leader' : ''}${
              isTeam ? ` tv-team--${player.teamId}` : ''
            }`}
          >
            <span className="tv-standing__rank">{index + 1}</span>
            <span className="tv-standing__name">
              {index === 0 ? <Crown /> : null}
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
            {move !== 0 ? (
              <span className={`tv-standing__move tv-standing__move--${move > 0 ? 'up' : 'down'}`}>
                {move > 0 ? `▲${move}` : `▼${-move}`}
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
    return <p className="tv-empty">There are no usable letters this round.</p>;
  }
  return (
    <div className="tv-values">
      {table.entries.map((entry, index) => {
        const added = table.source[entry.letter] === 'added';
        return (
          <div
            key={entry.letter}
            className={`tv-value${added ? ' tv-value--added' : ''}`}
            style={{ '--i': index } as CSSProperties}
          >
            <span className={`tv-value__letter lv-${Math.min(5, Math.max(1, entry.value))}`}>{entry.letter}</span>
            <span className="tv-value__count">{added ? 'computer' : `${entry.count} picked`}</span>
            <span className="tv-value__points">{entry.value} pt</span>
          </div>
        );
      })}
    </div>
  );
}
