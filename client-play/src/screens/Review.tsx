import type { ReactNode } from 'react';

import type { GameApi } from '../game';
import { Standings } from '../ui';

export function Review({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  const own = game.own;
  if (!state || !own) return null;

  const step = state.reviewSteps[state.reviewIndex];
  // With teams on, the scoring unit is the team, not the person holding the phone.
  const unitId = state.teamsEnabled && own.teamId ? own.teamId : own.id;
  const mine = state.lastRoundResult?.players.find((unit) => unit.id === unitId);
  const activeId = state.teamsEnabled && own.teamId ? own.teamId : own.id;

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
            <p className="reveal__who">only {step.credit} found it</p>
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
              {step.award.credit || 'shared too evenly — nobody scored'}
            </p>
          </>
        ) : step.kind === 'draft_penalty' ? (
          <>
            <p className="eyebrow">Draft penalty</p>
            <p className="reveal__word">{step.entries.length}</p>
            <p className="reveal__who">
              {step.entries.map((entry) => `${entry.label} ${entry.points}`).join(' · ')}
            </p>
          </>
        ) : step.kind === 'missed_words' ? (
          <>
            <p className="eyebrow">Words you missed</p>
            <p className="reveal__word">
              {step.words.map((missed) => `${missed.word} +${missed.points}`).join(' · ')}
            </p>
            <p className="reveal__who">formable from the pool — nobody found them</p>
          </>
        ) : (
          <>
            <p className="eyebrow">Standings</p>
            <Standings players={state.standings} activeId={activeId} />
          </>
        )}
      </div>

      {mine ? (
        <p className="myround">
          {state.teamsEnabled ? 'Your team' : 'Your round'}:{' '}
          <strong>{mine.roundScore}</strong> points from {mine.validWordCount} words
          {mine.draftPenalty !== 0 ? `, ${mine.draftPenalty} draft penalty` : ''}
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
