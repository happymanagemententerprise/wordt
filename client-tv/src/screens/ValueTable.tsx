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
  const feed = state.feed ?? [];
  const labelOf = (item: { playerName: string; teamName: string | null }) =>
    item.teamName ? `${item.teamName} · ${item.playerName}` : item.playerName;

  return (
    <section className="tv-stage tv-stage--words">
      <header className="tv-head">
        <div>
          <h2>Make words</h2>
          <p className="tv-hint">What everyone found stays secret until the review.</p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="left" />
      </header>

      <div className="tv-workspace">
        <div className="tv-board">
          {state.letterValues ? <ValueTable table={state.letterValues} /> : null}

          <ul className="tv-writers">
            {state.players.map((player) => (
              <li key={player.id} className="tv-writer">
                <span className="tv-writer__name">{player.name}</span>
                <span key={player.validWordCount} className="tv-writer__count tv-writer__count--pop">
                  {player.validWordCount}
                </span>
              </li>
            ))}
          </ul>
          <p className="tv-total">
            {total} {total === 1 ? 'word' : 'words'} found so far
          </p>
        </div>

        <aside className="tv-feed">
          <p className="tv-eyebrow">Just accepted</p>
          {feed.length === 0 ? (
            <p className="tv-hint">No words yet.</p>
          ) : (
            <ol className="tv-feed__list">
              {[...feed].reverse().map((item, index) => (
                <li
                  key={index === 0 ? `fresh-${feed.length}` : `${item.word}-${item.playerId}-${index}`}
                  className={`tv-feed__item${index === 0 ? ' tv-feed__item--new' : ''}`}
                >
                  <span className="tv-feed__word">{item.word}</span>
                  <span className="tv-feed__who">{labelOf(item)}</span>
                  <span className="tv-feed__points">+{item.score}</span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}