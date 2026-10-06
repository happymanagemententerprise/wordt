import type { ReactNode } from 'react';

import type { PublicPlayer, PublicRoomState } from '@wordt/shared';

function accuracy(player: PublicPlayer): string {
  if (player.totalTries === 0) return 'no tries';
  return `${Math.round(((player.totalTries - player.wrongTries) / player.totalTries) * 100)}% accuracy`;
}

export function Results({ state, final }: { state: PublicRoomState; final: boolean }): ReactNode {
  const standings = final ? (state.finalStandings ?? state.players) : state.players;
  const roundScores = new Map(
    (state.lastRoundResult?.players ?? []).map((player) => [player.id, player.roundScore]),
  );

  return (
    <section className="tv-stage">
      <header className="tv-head">
        <div>
          <p className="tv-eyebrow">
            Round {state.round} of {state.roundCount}
          </p>
          <h2>{final ? 'Final results' : `Round ${state.round} results`}</h2>
        </div>
      </header>

      <ol className="tv-standings">
        {standings.map((player, index) => {
          const round = roundScores.get(player.id);
          return (
            <li key={player.id} className="tv-standing">
              <span className="tv-standing__rank">{index + 1}</span>
              <span className="tv-standing__name">
                {player.name}
                {player.isHost ? <span className="tv-tag">host</span> : null}
                {!player.connected ? <span className="tv-tag tv-tag--away">offline</span> : null}
                {round !== undefined && !final ? <span className="tv-standing__round">+{round} this round</span> : null}
              </span>
              {final ? <span className="tv-standing__stats">{accuracy(player)}</span> : null}
              <span className="tv-standing__score">{player.score}</span>
            </li>
          );
        })}
      </ol>

      {!final ? <p className="tv-hint">The host continues from their phone.</p> : null}
    </section>
  );
}
