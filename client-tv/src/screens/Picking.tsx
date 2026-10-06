import type { ReactNode } from 'react';

import type { PublicRoomState } from '@wordt/shared';

import { Countdown } from '../ui';

export function Picking({ state }: { state: PublicRoomState }): ReactNode {
  const locked = state.players.filter((player) => player.pickedLocked).length;

  return (
    <section className="tv-stage">
      <header className="tv-head">
        <div>
          <h2>Pick your letters</h2>
          <p className="tv-hint">Letters picked by two or more players become usable.</p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="left" />
      </header>

      <p className="tv-tally">
        <strong>{locked}</strong> of <strong>{state.players.length}</strong> players ready
      </p>

      <ul className="tv-picks">
        {state.players.map((player) => {
          const percent = state.pickLimit === 0 ? 0 : Math.round((player.pickCount / state.pickLimit) * 100);
          const isTeam = player.teamId === player.id;
          return (
            <li
              key={player.id}
              className={`tv-pick${player.pickedLocked ? ' tv-pick--locked' : ''}${
                !isTeam && player.teamId ? ` tv-team--${player.teamId}` : ''
              }`}
            >
              <span className="tv-pick__name">
                {player.name}
                {!isTeam && player.teamId ? (
                  <span className={`tv-team-tag tv-team-tag--${player.teamId}`}>{player.teamId}</span>
                ) : null}
              </span>
              <span className="tv-pick__bar">
                <span className="tv-pick__bar-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="tv-pick__count">
                {player.pickCount}/{state.pickLimit}
              </span>
              <span className="tv-pick__letters">{player.pick.join(' ') || '—'}</span>
              <span className="tv-pick__state">{player.pickedLocked ? 'Locked in' : 'Picking…'}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}