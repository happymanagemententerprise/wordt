import type { ReactNode } from 'react';

import { RARE_LETTER_VALUE, type PublicRoomState } from '@wordt/shared';

import { feedStreaks } from '../scoreboard';
import { Countdown, ValueTable } from '../ui';

/** The round's rare letter, shown apart from the pool because it is never in it. */
export function RareLetter({ state }: { state: PublicRoomState }): ReactNode {
  if (!state.rareLetter) return null;
  return (
    <div className="tv-rare">
      <span className="tv-rare__label">Rare letter</span>
      <span className="tv-rare__letter">{state.rareLetter}</span>
      <span className="tv-rare__worth">
        +{RARE_LETTER_VALUE} if you&rsquo;re the only finder
      </span>
    </div>
  );
}

export function ValueTableScreen({ state }: { state: PublicRoomState }): ReactNode {
  if (!state.letterValues) return null;

  return (
    <section className="tv-stage">
      <header className="tv-head">
        <div>
          <h2>Letter values</h2>
          <p className="tv-hint">
      Overlap letters get rarity prices (vowels stay cheap); computer-added letters sit at their Scrabble value.
    </p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="left" />
      </header>
      <div className="tv-value-layout">
        <ValueTable table={state.letterValues} />
        <RareLetter state={state} />
      </div>
    </section>
  );
}

export function Words({ state }: { state: PublicRoomState }): ReactNode {
  const total = state.players.reduce((sum, player) => sum + player.validWordCount, 0);
  const feed = state.feed ?? [];
  const streaks = feedStreaks(feed);
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
          <RareLetter state={state} />
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
              {[...feed].reverse().map((item, index) => {
                const chronological = feed.length - 1 - index;
                const streak = streaks[chronological] ?? 1;
                const endsRun =
                  chronological === feed.length - 1 ||
                  feed[chronological + 1]?.playerId !== item.playerId;
                const big = item.score >= 10;
                return (
                  <li
                    key={index === 0 ? `fresh-${feed.length}` : `${item.word}-${item.playerId}-${index}`}
                    className={`tv-feed__item${index === 0 ? ' tv-feed__item--new' : ''}${
                      big ? ' tv-feed__item--big' : ''
                    }`}
                  >
                    <span className="tv-feed__word">{item.word}</span>
                    <span className="tv-feed__who">{labelOf(item)}</span>
                    {endsRun && streak >= 3 ? (
                      <span className="tv-feed__streak">{streak} in a row</span>
                    ) : null}
                    {big ? <span className="tv-feed__tag">big word</span> : null}
                    <span className="tv-feed__points">+{item.score}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </aside>
      </div>
    </section>
  );
}