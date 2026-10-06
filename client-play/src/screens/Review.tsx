import type { ReactNode } from 'react';

import type { GameApi } from '../game';
import { Standings } from '../ui';

export function Review({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  const own = game.own;
  if (!state || !own) return null;

  const step = state.reviewSteps[state.reviewIndex];
  const mine = state.lastRoundResult?.players.find((player) => player.id === own.id);
  const nameOf = (id: string) => state.players.find((player) => player.id === id)?.name ?? 'Someone';

  return (
    <section className="screen">
      <p className="eyebrow">
        Round {state.round} of {state.roundCount}
      </p>

      <div className="reveal" aria-live="polite">
        {!step ? (
          <p className="lead">Scoring the round…</p>
        ) : step.kind === 'unique_word' ? (
          <>
            <p className="eyebrow">Unique word · +{step.points}</p>
            <p className="reveal__word">{step.word}</p>
            <p className="reveal__who">only {step.playerName} found it</p>
          </>
        ) : step.kind === 'most_used_word' ? (
          <>
            <p className="eyebrow">Most used word</p>
            <p className="reveal__word">{step.words.join(' · ')}</p>
            <p className="reveal__who">the same word kept coming up</p>
          </>
        ) : step.kind === 'stat' ? (
          <>
            <p className="eyebrow">
              {step.award.label} · +{step.award.points}
            </p>
            <p className="reveal__word">{String(step.award.value)}</p>
            <p className="reveal__who">
              {step.award.winners.length > 0
                ? step.award.winners.map(nameOf).join(', ')
                : 'shared too evenly — nobody scored'}
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow">Standings</p>
            <Standings players={state.players} activeId={own.id} />
          </>
        )}
      </div>

      {mine ? (
        <p className="myround">
          Your round: <strong>{mine.roundScore}</strong> points from {mine.validWordCount} words
        </p>
      ) : null}

      <p className="hint">Keep watching the big screen for the rest of the results.</p>

      {own.isHost ? (
        <div className="actions">
          <button className="btn" type="button" disabled={game.busy} onClick={() => void game.nextReviewStep()}>
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
