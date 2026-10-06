import type { ReactNode } from 'react';

import type { GameApi } from '../game';
import { Standings } from '../ui';

export function Scoreboard({ game, final }: { game: GameApi; final: boolean }): ReactNode {
  const state = game.state;
  const own = game.own;
  if (!state || !own) return null;

  const standings = final ? (state.finalStandings ?? state.players) : state.players;
  const mine = state.lastRoundResult?.players.find((player) => player.id === own.id);

  return (
    <section className="screen">
      <h2>{final ? 'Final results' : `Round ${state.round} results`}</h2>

      {mine ? (
        <p className="myround">
          You scored <strong>{mine.roundScore}</strong> this round (
          {mine.baseScore} words
          {mine.sameWordPenalty !== 0 ? `, ${mine.sameWordPenalty} shared penalty` : ''}
          {mine.bonuses.length > 0 ? `, +${mine.bonuses.reduce((sum, b) => sum + b.points, 0)} bonuses` : ''})
        </p>
      ) : null}

      <Standings players={standings} activeId={own.id} showStats={final} />

      <div className="actions">
        {!own.isHost ? (
          <p className="hint">{final ? 'Waiting for the host…' : 'Waiting for the host to continue…'}</p>
        ) : final ? (
          <>
            <button className="btn btn--primary" type="button" disabled={game.busy} onClick={() => void game.newGame()}>
              New game
            </button>
            <button className="btn" type="button" disabled={game.busy} onClick={() => void game.backToLobby()}>
              Back to lobby
            </button>
          </>
        ) : (
          <button className="btn btn--primary" type="button" disabled={game.busy} onClick={() => void game.nextRound()}>
            Next round
          </button>
        )}
      </div>
    </section>
  );
}
