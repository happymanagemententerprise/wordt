import { useState, type FormEvent, type ReactNode } from 'react';

import { RARE_LETTER_VALUE } from '@wordt/shared';

import type { GameApi } from '../game';
import { Countdown, LetterChips } from '../ui';

interface Feedback {
  ok: boolean;
  text: string;
}

export function Words({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  const own = game.own;
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  if (!state || !own) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const word = draft.trim();
    if (!word) return;
    const ack = await game.submitWord(word);
    if (ack.ok) {
      setFeedback({ ok: true, text: `${ack.outcome?.word} · +${ack.outcome?.score ?? 0} points` });
      setDraft('');
    } else {
      setFeedback({ ok: false, text: ack.error ?? 'That word was not accepted.' });
    }
  };

  const roundPoints = Object.values(own.wordScores).reduce((total, points) => total + points, 0);
  const accuracy =
    own.totalTries > 0
      ? Math.round(((own.totalTries - own.wrongTries) / own.totalTries) * 100)
      : null;

  return (
    <section className="screen">
      <div className="screen__head">
        <div>
          <h2>Make words</h2>
          <p className="hint">Use any usable letter as often as you like.</p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} hint="left" />
      </div>

      {state.rareLetter ? (
        <div className="rare">
          <span className="rare__label">Rare letter</span>
          <span className="rare__letter">{state.rareLetter}</span>
          <span className="rare__worth">
            +{RARE_LETTER_VALUE} if you&rsquo;re the only finder
          </span>
        </div>
      ) : null}

      {state.letterValues ? <LetterChips table={state.letterValues} /> : null}

      <form className="composer" onSubmit={submit}>
        <input
          className="input input--word"
          value={draft}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          placeholder="Type a word"
          maxLength={40}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
        />
        <button className="btn btn--primary" type="submit" disabled={draft.trim().length === 0}>
          Add
        </button>
      </form>

      {feedback ? (
        <p className={`feedback${feedback.ok ? ' feedback--ok' : ' feedback--bad'}`} role="status">
          {feedback.text}
        </p>
      ) : null}

      <div className="scoreline">
        <span>
          <strong>{roundPoints}</strong> points
        </span>
        <span>
          <strong>{own.words.length}</strong> words
        </span>
        <span>
          <strong>{accuracy ?? '—'}%</strong> accuracy
        </span>
      </div>

      {own.words.length > 0 ? (
        <ul className="wordlist">
          {own.words.map((word) => (
            <li key={word}>
              <span>{word}</span>
              <span className="wordlist__points">+{own.wordScores[word] ?? 0}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No words yet — start typing above.</p>
      )}
    </section>
  );
}
