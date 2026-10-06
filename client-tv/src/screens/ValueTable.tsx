import type { ReactNode } from 'react';

import type { PublicRoomState } from '@wordt/shared';

import { Countdown, ValueTable } from '../ui';

export function ValueTableScreen({ state }: { state: PublicRoomState }): ReactNode {
  if (!state.letterValues) return null;

  return (
    <section className="tv-stage">
      <header className="tv-head">
        <div>
          <h2>Letter values</h2>
          <p className="tv-hint">Rarer letters are worth more. Every usable letter scores.</p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="left" />
      </header>
      <ValueTable table={state.letterValues} />
    </section>
  );
}

export function Words({ state }: { state: PublicRoomState }): ReactNode {
  const total = state.players.reduce((sum, player) => sum + player.validWordCount, 0);

  return (
    <section className="tv-stage">
      <header className="tv-head">
        <div>
          <h2>Make words</h2>
          <p className="tv-hint">What everyone found stays secret until the review.</p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="left" />
      </header>

      {state.letterValues ? <ValueTable table={state.letterValues} /> : null}

      <ul className="tv-writers">
        {state.players.map((player) => (
          <li key={player.id} className="tv-writer">
            <span className="tv-writer__name">{player.name}</span>
            <span className="tv-writer__count">{player.validWordCount}</span>
          </li>
        ))}
      </ul>
      <p className="tv-total">
        {total} {total === 1 ? 'word' : 'words'} found so far
      </p>
    </section>
  );
}
