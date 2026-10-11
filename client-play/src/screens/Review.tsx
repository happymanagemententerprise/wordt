import type { ReactNode } from 'react';

import { formatRound } from '@wordt/shared';

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
      <p className="eyebrow">{formatRound(state.round, state.roundCount)}</p>

      <div className="reveal" key={state.reviewIndex} aria-live="polite">
        {!step ? (
          <p className="lead">Scoring the round…</p>
        ) : step.kind === 'rare_letter' ? (
          <>
            <p className="eyebrow">
              Rare letter · {step.reveal.letter}
              {step.reveal.awarded.length > 0 ? ` · +${step.reveal.value}` : ''}
            </p>
            <p className="reveal__word">{step.reveal.letter}</p>
<p className="reveal__who">
              {step.reveal.finders.length === 0
                ? 'nobody used it this round'
                : step.reveal.zeroed.length > 0 && step.reveal.awarded.length === 0
                  ? `${step.reveal.finders.map((finder) => finder.credit).join(' and ')} submitted the same rare word — it netted to zero`
                  : step.reveal.zeroed.length > 0
                    ? `${step.reveal.awarded.map((id) => step.reveal.finders.find((f) => f.id === id)?.credit ?? 'someone').join(', ')} kept it • ${step.reveal.zeroed.map((id) => step.reveal.finders.find((f) => f.id === id)?.credit ?? 'someone').join(', ')} shared a zeroed word`
                    : step.reveal.awarded.length > 1
                      ? `${step.reveal.finders.map((finder) => finder.credit).join(' and ')} both found it`
                      : `${step.reveal.finders[0]!.credit} found it in "${step.reveal.finders[0]!.word}"`}
            </p>
          </>
        ) : step.kind === 'unique_words' ? (
          <>
            <p className="eyebrow">Unique words</p>
            <div className="unique-groups">
              {step.groups.map((group) => (
                <div key={group.playerId} className="unique-group">
                  <p className="unique-group__who">{group.credit}</p>
                  <p className="unique-group__words">
                    {group.words.map((word) => `${word.word} +${word.points}`).join(' · ')}
                  </p>
                </div>
              ))}
            </div>
            <p className="reveal__who">words only these players found</p>
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
        ) : step.kind === 'spotlight' ? (
          <>
            <p className="eyebrow">Spotlight</p>
            <ul className="spotlight">
              {step.words.map((missed) => (
                <li key={missed.word} className="spotlight__row">
                  <span className="spotlight__word">
                    {missed.word}
                    <span className="spotlight__points">+{missed.points}</span>
                  </span>
                  {missed.meaning ? (
                    <span className="spotlight__meaning">
                      {missed.meaning.partOfSpeech ? (
                        <em className="spotlight__pos">{missed.meaning.partOfSpeech}</em>
                      ) : null}
                      {missed.meaning.definition}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="reveal__who">the five biggest words nobody made</p>
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
