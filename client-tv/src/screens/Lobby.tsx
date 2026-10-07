import { QRCodeSVG } from 'qrcode.react';
import type { ReactNode } from 'react';

import type { PublicRoomState } from '@wordt/shared';

import { PLAY_URL } from '../game';

export function Lobby({ state }: { state: PublicRoomState }): ReactNode {
  const joinUrl = `${PLAY_URL}/?room=${state.roomCode}`;

  return (
    <section className="tv-stage tv-stage--lobby">
      <div className="tv-lobby__code">
        <p className="tv-eyebrow">Grab your phone and join</p>
        <p className="tv-code" aria-label={`Room code ${state.roomCode.split('').join(' ')}`}>
          {state.roomCode.split('').join(' ')}
        </p>
        <QRCodeSVG value={joinUrl} size={168} bgColor="#0b0f1a" fgColor="#ffd166" level="M" />
        <p className="tv-lobby__url">{joinUrl}</p>
      </div>

      <div className="tv-lobby__players">
        {state.teamsEnabled && state.teams ? (
          <div className="tv-lobby__teams">
            {state.teams.map((team) => (
              <div key={team.id} className={`tv-lobby__team tv-team--${team.id}`}>
                <p className="tv-team-name">{team.name}</p>
                <ul className="tv-namelist">
                  {state.players
                    .filter((player) => player.teamId === team.id)
                    .map((player) => (
                      <li key={player.id} className={player.connected ? undefined : 'tv-namelist__away'}>
                        {player.name}
                        {player.isHost ? <span className="tv-tag">host</span> : null}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <>
            <p className="tv-eyebrow">
              Players <span className="tv-count">{state.players.length}</span>
            </p>
            <ul className="tv-namelist">
              {state.players.map((player) => (
                <li key={player.id} className={player.connected ? undefined : 'tv-namelist__away'}>
                  {player.name}
                  {player.isHost ? <span className="tv-tag">host</span> : null}
                </li>
              ))}
            </ul>
          </>
        )}
        {state.players.length < 2 ? (
          <p className="tv-hint">At least two players are needed.</p>
        ) : (
          <p className="tv-hint">Waiting for the host to start the game…</p>
        )}
        <p className="tv-lobby__meta">
          {state.players.length}/{state.maxPlayers} joined
          {state.roundSeconds ? ` · rounds last ${state.roundSeconds}s` : ' · host is choosing a round length'}
        </p>
      </div>
    </section>
  );
}