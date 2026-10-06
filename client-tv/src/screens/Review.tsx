import type { ReactNode } from 'react';

import type { PublicRoomState, ReviewStep } from '@wordt/shared';

import { Standings } from '../ui';

function winnerNames(step: Extract<ReviewStep, { kind: 'stat' }>, state: PublicRoomState): string {
  return step.award.winners
    .map((id) => state.players.find((player) => player.id === id)?.name ?? id)
    .join(', ');
}

function Reveal({ step, state }: { step: ReviewStep; state: PublicRoomState }): ReactNode {
  switch (step.kind) {
    case 'unique_word':
      return (
        <div className="tv-reveal">
          <p className="tv-eyebrow">Found by one player only</p>
          <p className="tv-reveal__word">{step.word}</p>
          <p className="tv-reveal__who">
            {step.playerName} <span className="tv-reveal__points">+{step.points}</span>
          </p>
        </div>
      );
    case 'most_used_word':
      return (
        <div className="tv-reveal">
          <p className="tv-eyebrow">Found by the most players</p>
          <p className="tv-reveal__word">{step.words.join(' · ')}</p>
        </div>
      );
    case 'stat':
      return (
        <div className="tv-reveal">
          <p className="tv-eyebrow">+{step.award.points} points</p>
          <p className="tv-reveal__word">{step.award.label}</p>
          <p className="tv-reveal__who">
            {winnerNames(step, state)} <span className="tv-reveal__points">· {String(step.award.value)}</span>
          </p>
        </div>
      );
    case 'leaderboard':
      return <Standings players={state.players} />;
  }
}

export function Review({ state }: { state: PublicRoomState }): ReactNode {
  const step = state.reviewSteps[state.reviewIndex];
  const revealed = state.reviewIndex + 1;

  return (
    <section className="tv-stage tv-stage--review">
      <header className="tv-head">
        <div>
          <p className="tv-eyebrow">
            Round {state.round} of {state.roundCount}
          </p>
          <h2>Review</h2>
        </div>
        {state.reviewSteps.length > 0 ? (
          <div className="tv-dots" aria-label={`Step ${revealed} of ${state.reviewSteps.length}`}>
            {state.reviewSteps.map((_, index) => (
              <span
                key={index}
                className={`tv-dot${index < state.reviewIndex ? ' tv-dot--done' : ''}${
                  index === state.reviewIndex ? ' tv-dot--on' : ''
                }`}
              />
            ))}
          </div>
        ) : null}
      </header>

      {step ? <Reveal step={step} state={state} /> : <Standings players={state.players} />}
    </section>
  );
}
