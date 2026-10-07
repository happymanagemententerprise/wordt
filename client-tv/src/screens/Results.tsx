import type { CSSProperties, ReactNode } from 'react';

import type { PublicPlayer, PublicRoomState, PublicTeam } from '@wordt/shared';

import { rankChanges } from '../scoreboard';
import { Crown } from '../ui';

function accuracy(player: PublicPlayer): string {
  if (player.totalTries === 0) return 'no tries';
  return `${Math.round(((player.totalTries - player.wrongTries) / player.totalTries) * 100)}% accuracy`;
}

function Move({ delta }: { delta: number }): ReactNode {
  if (delta === 0) return null;
  return (
    <span className={`tv-standing__move tv-standing__move--${delta > 0 ? 'up' : 'down'}`}>
      {delta > 0 ? `▲${delta}` : `▼${-delta}`}
    </span>
  );
}

const CONFETTI_COLORS = ['#ffd166', '#3ddc97', '#7dd3fc', '#ff8fab', '#a5b4fc'];

export function Results({ state, final }: { state: PublicRoomState; final: boolean }): ReactNode {
  const standings = final ? (state.finalStandings ?? state.standings) : state.standings;
  const roundScores = new Map(
    (state.lastRoundResult?.players ?? []).map((player) => [player.id, player.roundScore]),
  );
  const moves = rankChanges(state);
  const membersOf = (teamId: string): PublicPlayer[] =>
    state.players.filter((player) => player.teamId === teamId);
  const teamNames = (teamId: string): string | null => {
    const team = (state.teams ?? []).find((entry: PublicTeam) => entry.id === teamId);
    return team ? membersOf(teamId).map((member) => member.name).join(' · ') : null;
  };

  if (final) {
    return (
      <section className="tv-stage">
        <header className="tv-head">
          <div>
            <p className="tv-eyebrow">
              Round {state.round} of {state.roundCount}
            </p>
            <h2>Final results</h2>
          </div>
        </header>

        <div className="tv-podium-wrap">
          <ol className="tv-podium">
            {standings.slice(0, 3).map((player, index) => {
              const rank = index + 1;
              const isTeam = player.teamId === player.id;
              const members = isTeam ? teamNames(player.id) : null;
              return (
                <li
                  key={player.id}
                  className={`tv-podium__col tv-podium__col--${rank}${isTeam ? ` tv-team--${player.teamId}` : ''}`}
                >
                  <span className={`tv-podium__medal tv-podium__medal--${rank}`}>{rank}</span>
                  <span className="tv-podium__name">
                    {rank === 1 ? <Crown podium /> : null}
                    {player.name}
                  </span>
                  {members ? <span className="tv-standing__members">{members}</span> : null}
                  <span className="tv-podium__score">{player.score}</span>
                  <span className="tv-podium__stats">{accuracy(player)}</span>
                  <Move delta={moves.get(player.id) ?? 0} />
                  <span className="tv-podium__bar" />
                </li>
              );
            })}
          </ol>
          <div className="tv-confetti" aria-hidden="true">
            {Array.from({ length: 32 }, (_, i) => (
              <span
                key={i}
                className="tv-confetti__piece"
                style={
                  {
                    left: `${(i * 37) % 100}%`,
                    animationDelay: `${(i % 8) * 0.3}s`,
                    animationDuration: `${2.8 + ((i * 7) % 9) / 10}s`,
                    '--c': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    '--r': `${(i * 53) % 360}deg`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="tv-stage">
      <header className="tv-head">
        <div>
          <p className="tv-eyebrow">
            Round {state.round} of {state.roundCount}
          </p>
          <h2>Round {state.round} results</h2>
        </div>
      </header>

      <ol className="tv-standings">
        {standings.map((player, index) => {
          const round = roundScores.get(player.id);
          const isTeam = player.teamId === player.id;
          const members = isTeam ? teamNames(player.id) : null;
          return (
            <li
              key={player.id}
              style={{ '--i': index } as CSSProperties}
              className={`tv-standing${index === 0 ? ' tv-standing--leader' : ''}${
                isTeam ? ` tv-team--${player.teamId}` : ''
              }`}
            >
              <span className="tv-standing__rank">{index + 1}</span>
              <span className="tv-standing__name">
                {index === 0 ? <Crown /> : null}
                {player.name}
                {player.isHost ? <span className="tv-tag">host</span> : null}
                {!player.connected ? <span className="tv-tag tv-tag--away">offline</span> : null}
                {round !== undefined ? <span className="tv-standing__round">+{round} this round</span> : null}
                {members ? <span className="tv-standing__members">{members}</span> : null}
              </span>
              <Move delta={moves.get(player.id) ?? 0} />
              <span className="tv-standing__score">{player.score}</span>
            </li>
          );
        })}
      </ol>

      <p className="tv-hint">The host continues from their phone.</p>
    </section>
  );
}
