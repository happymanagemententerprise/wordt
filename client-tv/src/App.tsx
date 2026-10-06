import type { ReactNode } from 'react';

import type { PublicRoomState } from '@wordt/shared';

import { useTv } from './game';
import { Lobby } from './screens/Lobby';
import { Picking } from './screens/Picking';
import { Results } from './screens/Results';
import { Review } from './screens/Review';
import { RoomEntry } from './screens/RoomEntry';
import { ValueTableScreen, Words } from './screens/ValueTable';
import { phaseLabel } from './ui';

function Centered({ title, detail }: { title: string; detail?: string }): ReactNode {
  return (
    <div className="tv-centered">
      <p className="tv-centered__title">{title}</p>
      {detail ? <p className="tv-centered__detail">{detail}</p> : null}
    </div>
  );
}

function renderPhase(state: PublicRoomState): ReactNode {
  switch (state.phase) {
    case 'LOBBY':
      return <Lobby state={state} />;
    case 'PICKING':
      return <Picking state={state} />;
    case 'VALUE_TABLE':
      return <ValueTableScreen state={state} />;
    case 'WORDS':
      return <Words state={state} />;
    case 'NOTICE':
      return (
        <section className="tv-stage tv-stage--notice">
          <p className="tv-eyebrow">Heads up</p>
          <p className="tv-notice">{state.notice}</p>
        </section>
      );
    case 'REVIEW':
      return <Review state={state} />;
    case 'RESULTS':
      return <Results state={state} final={false} />;
    case 'GAME_OVER':
      return <Results state={state} final />;
    default:
      return <Centered title="Loading…" />;
  }
}

export default function App(): ReactNode {
  const tv = useTv();

  if (!tv.connected) return <Centered title="Connecting…" detail="Looking for the Wordt server." />;
  if (!tv.watching) return <RoomEntry error={tv.error} onSubmit={(code) => void tv.watch(code)} />;

  const state = tv.state;
  if (!state) return <Centered title="Joining…" detail={tv.roomCode ?? ''} />;

  return (
    <div className="tv">
      <header className="tv-topbar">
        <span className="tv-brand">Wordt</span>
        <span className="tv-topbar__code">{state.roomCode}</span>
        <span className="tv-pill">
          Round {state.round}/{state.roundCount}
        </span>
        <span className="tv-pill tv-pill--phase">{phaseLabel(state.phase)}</span>
      </header>
      <main className="tv-content">{renderPhase(state)}</main>
    </div>
  );
}
