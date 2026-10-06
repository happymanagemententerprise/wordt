import type { ReactNode } from 'react';

import type { GameApi } from '../game';
import { Countdown, ValueTable } from '../ui';

export function ValueTableScreen({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  if (!state) return null;

  return (
    <section className="screen">
      <div className="screen__head">
        <div>
          <h2>Letter values</h2>
          <p className="hint">Rarer letters are worth more. Every usable letter scores.</p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="to words" />
      </div>

      {state.letterValues ? <ValueTable table={state.letterValues} /> : null}
    </section>
  );
}
