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
        {state.players.map((player) => (
          <li key={player.id} className={`tv-pick${player.pickedLocked ? ' tv-pick--locked' : ''}`}>
            <span className="tv-pick__name">{player.name}</span>
            <span className="tv-pick__count">
              {player.pickCount}/{state.pickLimit}
            </span>
            <span className="tv-pick__state">{player.pickedLocked ? 'Locked in' : 'Picking…'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
