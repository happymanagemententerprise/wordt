import type { ReactNode } from 'react';

import type { PublicRoomState, ReviewStep } from '@wordt/shared';

import { Standings } from '../ui';

function Reveal({ step, state }: { step: ReviewStep; state: PublicRoomState }): ReactNode {
  const memberNames = (id: string) =>
    state.players.filter((player) => player.teamId === id).map((player) => player.name).join(' · ') || null;

  switch (step.kind) {
    case 'unique_word':
      return (
        <div className="tv-reveal">
          <p className="tv-eyebrow">Found by one player only</p>
          <p className="tv-reveal__word">{step.word}</p>
          <p className="tv-reveal__who">
            {step.credit} <span className="tv-reveal__points">+{step.points}</span>
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
            {step.award.credit || 'shared too evenly'}
            <span className="tv-reveal__points"> · {String(step.award.value)}</span>
          </p>
        </div>
      );
    case 'draft_penalty': {
      const total = step.entries.reduce((sum, entry) => sum + entry.points, 0);
      return (
        <div className="tv-reveal">
          <p className="tv-eyebrow">Draft penalty</p>
          <p className="tv-reveal__word">{total}</p>
          <p className="tv-reveal__who">
            {step.entries.map((entry) => `${entry.label} ${entry.points}`).join(' · ')}
          </p>
        </div>
      );
    }
    case 'missed_words': {
      const best = step.words.slice(0, 3).map((word) => `${word.word} +${word.points}`).join(' · ');
      return (
        <div className="tv-reveal">
          <p className="tv-eyebrow">Words you missed</p>
          <p className="tv-reveal__word">{step.words.length} formable from the pool</p>
          <p className="tv-reveal__who">{best}</p>
        </div>
      );
    }
    case 'leaderboard':
      return <Standings players={state.standings} teamLabel={memberNames} />;
  }
}

export function Review({ state }: { state: PublicRoomState }): ReactNode {
  const step = state.reviewSteps[state.reviewIndex];
  const revealed = state.reviewIndex + 1;
  const memberNames = (id: string) =>
    state.players.filter((player) => player.teamId === id).map((player) => player.name).join(' · ') || null;

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

      {step ? <Reveal step={step} state={state} /> : <Standings players={state.standings} teamLabel={memberNames} />}
    </section>
  );
}