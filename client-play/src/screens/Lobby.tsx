import type { ReactNode } from 'react';

import type { GameApi } from '../game';
import { Standings } from '../ui';

export function Lobby({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  const own = game.own;
  if (!state || !own) return null;

  const connectedPlayers = state.players.filter((player) => player.connected).length;
  const needsMorePlayers = connectedPlayers < 2;

  return (
    <section className="screen">
      <h2>Room code</h2>
      <p className="room-code" aria-label={`Room code ${state.roomCode.split('').join(' ')}`}>
        {state.roomCode.split('').join(' ')}
      </p>
      <p className="hint">Friends open Wordt on their phone and join with this code.</p>

      <h3 className="subhead">
        Players <span className="count">{connectedPlayers}/16</span>
      </h3>
      <Standings players={state.players} activeId={own.id} />

      {own.isHost ? (
        <div className="actions">
          <button
            className="btn btn--primary"
            type="button"
            disabled={game.busy || needsMorePlayers}
            onClick={() => void game.start()}
          >
            {game.busy ? 'Starting…' : 'Start game'}
          </button>
          {needsMorePlayers ? <p className="hint">At least two players are needed.</p> : null}
        </div>
      ) : (
        <p className="hint">Waiting for the host to start the game…</p>
      )}
    </section>
  );
}
