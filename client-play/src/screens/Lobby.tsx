import type { ReactNode } from 'react';

import {
  ROUND_SECONDS_CHOICES,
  TEAM_SIZE,
  teamIdsForPlayerCount,
  teamName,
} from '@wordt/shared';

import type { GameApi } from '../game';
import { Standings } from '../ui';

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function Lobby({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  const own = game.own;
  if (!state || !own) return null;

  const connectedPlayers = state.players.filter((player) => player.connected).length;
  const needsMorePlayers = connectedPlayers < 2;
  const teams = teamIdsForPlayerCount(state.players.length);

  return (
    <section className="screen">
      <h2>Room code</h2>
      <p className="room-code" aria-label={`Room code ${state.roomCode.split('').join(' ')}`}>
        {state.roomCode.split('').join(' ')}
      </p>
      <p className="hint">Friends open Wordt on their phone and join with this code.</p>

      <h3 className="subhead">
        Players <span className="count">{connectedPlayers}/{state.maxPlayers}</span>
      </h3>
      <Standings players={state.players} activeId={own.id} />

      {state.teamsEnabled ? (
        <>
          <h3 className="subhead">
            Teams <span className="count">{TEAM_SIZE} per team</span>
          </h3>
          <div className="teams">
            {teams.map((teamId) => {
              const members = state.players.filter((player) => player.teamId === teamId);
              const mine = own.teamId === teamId;
              const full = members.length >= TEAM_SIZE;
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
                    {members.length}/{TEAM_SIZE} · {mine ? 'you' : 'tap to join'}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <h3 className="subhead">
        Round length
        <span className="count">{state.roundSeconds ? formatSeconds(state.roundSeconds) : 'not set'}</span>
      </h3>
      <div className="timer-choices" role="group" aria-label="Round length">
        {ROUND_SECONDS_CHOICES.map((seconds) => {
          const chosen = state.roundSeconds === seconds;
          return (
            <button
              key={seconds}
              type="button"
              className={`chip-btn${chosen ? ' chip-btn--on' : ''}`}
              disabled={game.busy || (!own.isHost && !chosen)}
              onClick={() => void game.setRoundSeconds(seconds)}
            >
              {formatSeconds(seconds)}
            </button>
          );
        })}
      </div>
      <p className="hint">
        {own.isHost
          ? 'Pick how long everyone gets to write words. (Locks in for this game.)'
          : `The host has set ${state.roundSeconds ? formatSeconds(state.roundSeconds) : 'no round length'} for each round.`}
      </p>

      {own.isHost ? (
        <>
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
              disabled={game.busy || needsMorePlayers || state.roundSeconds == null}
              onClick={() => void game.start()}
            >
              {game.busy ? 'Starting…' : 'Start game'}
            </button>
            {needsMorePlayers ? <p className="hint">At least two players are needed.</p> : null}
            {!needsMorePlayers && state.roundSeconds == null ? (
              <p className="hint">Set a round length to enable Start.</p>
            ) : null}
          </div>
          <button
            className="btn btn--ghost btn--danger"
            type="button"
            disabled={game.busy}
            onClick={() => void game.leave()}
          >
            Leave room
          </button>
        </>
      ) : (
        <>
          <p className="hint">Waiting for the host to start the game…</p>
          <button
            className="btn btn--ghost"
            type="button"
            disabled={game.busy}
            onClick={() => void game.leave()}
          >
            Leave room
          </button>
        </>
      )}
    </section>
  );
}