import type { CSSProperties, ReactNode } from 'react';

import type { GameApi } from '../game';
import { Standings } from '../ui';

const CONFETTI_COLORS = ['#ff8a3d', '#ffd166', '#4dd0a0', '#5aa9ff', '#c792ea'];

function Confetti(): ReactNode {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <span
          key={i}
          className="confetti__piece"
          style={
            {
              '--x': `${(i * 37) % 100}%`,
              '--drift': `${((i % 5) - 2) * 22}px`,
              '--delay': `${(i % 7) * 0.16}s`,
              '--dur': `${2.4 + (i % 6) * 0.28}s`,
              '--color': CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function Scoreboard({ game, final }: { game: GameApi; final: boolean }): ReactNode {
  const state = game.state;
  const own = game.own;
  if (!state || !own) return null;

  const standings = final ? (state.finalStandings ?? state.standings) : state.standings;
  const teamPlay = state.teamsEnabled && Boolean(own.teamId);
  const unitId = teamPlay ? (own.teamId as string) : own.id;
  const mine = state.lastRoundResult?.players.find((unit) => unit.id === unitId);
  const champion = final ? (standings[0] ?? null) : null;

  return (
    <section className={`screen${final ? ' screen--final' : ''}`}>
      {final ? <Confetti /> : null}
      <h2>{final ? 'Final results' : `Round ${state.round} results`}</h2>

      {champion ? (
        <div className="champion">
          <p className="champion__label">Champion</p>
          <p className="champion__name">{champion.name}</p>
          <p className="champion__score">{champion.score} points</p>
        </div>
      ) : null}

      {mine ? (
        <p className="myround">
          {teamPlay ? 'Your team scored' : 'You scored'}{' '}
          <strong>{mine.roundScore}</strong> this round (
          {mine.baseScore} words
          {mine.sameWordPenalty !== 0 ? `, ${mine.sameWordPenalty} shared penalty` : ''}
          {mine.draftPenalty !== 0 ? `, ${mine.draftPenalty} draft penalty` : ''}
          {mine.bonuses.length > 0 ? `, +${mine.bonuses.reduce((sum, b) => sum + b.points, 0)} bonuses` : ''})
        </p>
      ) : null}

      <Standings players={standings} activeId={unitId} showStats={final} />

      <div className="actions">
        {!own.isHost ? (
          <>
            <p className="hint">{final ? 'Waiting for the host…' : 'Waiting for the host to continue…'}</p>
            {final ? (
              <button className="btn btn--ghost" type="button" disabled={game.busy} onClick={() => void game.leave()}>
                Leave room
              </button>
            ) : null}
          </>
        ) : final ? (
          <>
            <button className="btn btn--primary" type="button" disabled={game.busy} onClick={() => void game.newGame()}>
              New game
            </button>
            <button className="btn" type="button" disabled={game.busy} onClick={() => void game.backToLobby()}>
              Back to lobby
            </button>
            <button className="btn btn--ghost btn--danger" type="button" disabled={game.busy} onClick={() => void game.leave()}>
              Leave room
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
