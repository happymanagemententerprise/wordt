import type { ReactNode } from 'react';

import { TEAM_IDS, TEAM_MAX_PLAYERS, teamName } from '@wordt/shared';

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

      {state.teamsEnabled ? (
        <>
          <h3 className="subhead">
            Teams <span className="count">{TEAM_MAX_PLAYERS} per team</span>
          </h3>
          <div className="teams">
            {TEAM_IDS.map((teamId) => {
              const members = state.players.filter((player) => player.teamId === teamId);
              const mine = own.teamId === teamId;
              const full = members.length >= TEAM_MAX_PLAYERS;
              return (
                <button
                  key={teamId}
                  type="button"
                  className={`team-card${mine ? ' team-card--on' : ''}`}
                  disabled={game.busy || (!mine && full)}
                  onClick={() => void game.setTeam(teamId)}
                >
                  <span className="team-card__name">{teamName(teamId)}</span>
                  <span className="team-card__meta">
                    {members.length > 0 ? members.map((member) => member.name).join(', ') : 'open'}
                  </span>
                  <span className="team-card__meta">
                    {members.length}/{TEAM_MAX_PLAYERS} · {mine ? 'you' : 'tap to join'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {own.isHost ? (
        <div className="actions">
          <button
            className="btn btn--ghost"
            type="button"
            disabled={game.busy}
            onClick={() => void game.setTeamsEnabled(!state.teamsEnabled)}
          >
            {state.teamsEnabled ? 'Turn teams off' : 'Turn teams on'}
          </button>
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
