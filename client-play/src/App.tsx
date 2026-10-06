import type { ReactNode } from 'react';

import { useGame, type GameApi } from './game';
import { Countdown, PhasePill } from './ui';
import { Join } from './screens/Join';
import { Lobby } from './screens/Lobby';
import { Pick } from './screens/Pick';
import { Review } from './screens/Review';
import { Scoreboard } from './screens/Scoreboard';
import { ValueTableScreen } from './screens/ValueTable';
import { Words } from './screens/Words';

function Splash({ title, detail }: { title: string; detail?: string }): ReactNode {
  return (
    <div className="splash">
      <p className="splash__title">{title}</p>
      {detail ? <p className="splash__detail">{detail}</p> : null}
    </div>
  );
}

function Notice({ game }: { game: GameApi }): ReactNode {
  return (
    <section className="screen">
      <h2>Heads up</h2>
      <p className="lead">{game.state?.notice}</p>
      <Countdown endsAt={game.state?.phaseEndsAt ?? null} />
    </section>
  );
}

function renderScreen(game: GameApi): ReactNode {
  const state = game.state;
  if (!state) return null;

  switch (state.phase) {
    case 'LOBBY':
      return <Lobby game={game} />;
    case 'PICKING':
      return <Pick game={game} />;
    case 'VALUE_TABLE':
      return <ValueTableScreen game={game} />;
    case 'WORDS':
      return <Words game={game} />;
    case 'NOTICE':
      return <Notice game={game} />;
    case 'REVIEW':
      return <Review game={game} />;
    case 'RESULTS':
      return <Scoreboard game={game} final={false} />;
    case 'GAME_OVER':
      return <Scoreboard game={game} final />;
    default:
      return <Splash title="Loading…" />;
  }
}

export default function App(): ReactNode {
  const game = useGame();
  const { state, own } = game;

  if (!game.connected) return <Splash title="Connecting…" detail="Looking for the Wordt server." />;
  if (!game.seat) return <Join game={game} />;
  if (!state || !own) return <Splash title="Joining…" detail={game.seat.roomCode} />;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Wordt</span>
        <span className="topbar__code">{state.roomCode}</span>
        <PhasePill round={state.round} roundCount={state.roundCount} phase={state.phase} />
        {own.isHost && state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER' ? (
          <button
            className="btn btn--ghost topbar__end"
            type="button"
            disabled={game.busy}
            onClick={() => void game.endGame()}
          >
            End game
          </button>
        ) : null}
      </header>

      {game.error ? (
        <div className="banner banner--error" role="alert">
          <span>{game.error}</span>
          <button type="button" className="banner__close" onClick={game.dismissError} aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}

      <main className="content">{renderScreen(game)}</main>
    </div>
  );
}
