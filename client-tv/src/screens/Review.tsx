import type { CSSProperties, ReactNode } from 'react';

import { formatRound, type PublicRoomState, type ReviewStep } from '@wordt/shared';

import { rankChanges } from '../scoreboard';
import { Standings } from '../ui';

function Reveal({ step, state }: { step: ReviewStep; state: PublicRoomState }): ReactNode {
  const memberNames = (id: string) =>
    state.players.filter((player) => player.teamId === id).map((player) => player.name).join(' · ') || null;

  switch (step.kind) {
    case 'rare_letter': {
      const { reveal } = step;
      const tied = reveal.finders.length > 1;
      const found = reveal.finders.length > 0;
      return (
        <div className="tv-reveal tv-reveal--rare">
          <p className="tv-eyebrow">Rare letter</p>
          <p className="tv-reveal__rare">{reveal.letter}</p>
          <p className="tv-reveal__who">
            {reveal.zeroed.length > 0 && reveal.awarded.length === 0 ? (
              <>{reveal.finders.map((finder) => finder.credit).join(' and ')} submitted the same rare word — it netted to zero.</>
            ) : reveal.zeroed.length > 0 ? (
              <>{reveal.awarded.map((id) => reveal.finders.find((f) => f.id === id)?.credit ?? 'someone').join(', ')} kept it • {reveal.zeroed.map((id) => reveal.finders.find((f) => f.id === id)?.credit ?? 'someone').join(', ')} shared a zeroed word.</>
            ) : tied ? (
              <>
                {reveal.finders.map((finder) => finder.credit).join(' and ')} both found it
                <span className="tv-reveal__points"> — nobody credited</span>
              </>
            ) : found ? (
              <>
                {reveal.finders[0]!.credit} found it in “{reveal.finders[0]!.word}”
                <span className="tv-reveal__points"> +{reveal.value}</span>
              </>
            ) : (
              <>Nobody used it this round.</>
            )}
          </p>
        </div>
      );
    }
    case 'unique_words': {
      const columns = [step.groups.slice(0, Math.ceil(step.groups.length / 2)), step.groups.slice(Math.ceil(step.groups.length / 2))].filter((column) => column.length > 0);
      return (
        <div className="tv-reveal tv-reveal--unique">
          <p className="tv-eyebrow">Words only one player found</p>
          <div className="tv-unique">
            {columns.map((column, index) => (
              <div key={index} className="tv-unique__col">
                {column.map((group) => (
                  <div key={group.playerId} className="tv-unique__group">
                    <p className="tv-unique__who">{group.credit}</p>
                    <p className="tv-unique__words">
                      {group.words.map((word) => (
                        <span key={word.word} className="tv-unique__word">
                          {word.word}
                          <em>+{word.points}</em>
                        </span>
                      ))}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }
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
    case 'spotlight':
      return (
        <div className="tv-reveal tv-reveal--spotlight">
          <p className="tv-eyebrow">Spotlight</p>
          <p className="tv-reveal__sub">the five biggest words nobody made</p>
          <ul className="tv-spotlight">
            {step.words.map((missed, index) => (
              <li key={missed.word} className="tv-spotlight__row" style={{ '--i': index } as CSSProperties}>
                <div className="tv-spotlight__head">
                  <span className="tv-spotlight__word">{missed.word}</span>
                  <span className="tv-spotlight__points">+{missed.points}</span>
                </div>
                {missed.meaning ? (
                  <p className="tv-spotlight__meaning" style={{ '--i': index } as CSSProperties}>
                    {missed.meaning.partOfSpeech ? (
                      <em className="tv-spotlight__pos">{missed.meaning.partOfSpeech}</em>
                    ) : null}
                    {missed.meaning.definition}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="tv-spotlight__credit">
            Definitions from Wiktionary via FreeDictionaryAPI.com (CC BY-SA 4.0)
          </p>
        </div>
      );
    case 'leaderboard':
      return <Standings players={state.standings} teamLabel={memberNames} rankChange={rankChanges(state)} />;
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
          <p className="tv-eyebrow">{formatRound(state.round, state.roundCount)}</p>
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

      {step ? <Reveal key={state.reviewIndex} step={step} state={state} /> : <Standings players={state.standings} teamLabel={memberNames} />}
    </section>
  );
}