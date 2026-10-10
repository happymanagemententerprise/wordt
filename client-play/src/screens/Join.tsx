import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import type { GameApi } from '../game';
import { Rules } from './Rules';

const ROOM_PARAM = 'room';

function codeFromUrl(): string {
  try {
    return (new URLSearchParams(window.location.search).get(ROOM_PARAM) ?? '').toUpperCase();
  } catch {
    return '';
  }
}

export function Join({ game }: { game: GameApi }): ReactNode {
  const initialCode = codeFromUrl();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [lockedToJoin] = useState(Boolean(initialCode));
  const [showRules, setShowRules] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [pending, setPending] = useState<'join' | 'create' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // A room code pasted into the URL switches us to Join and fills the field, live.
  useEffect(() => {
    const onPop = () => {
      const next = codeFromUrl();
      setCode(next);
      if (next) setMode('join');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Keep the URL's ?room= in step with what is typed on the Join form.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (mode === 'join' && code) url.searchParams.set(ROOM_PARAM, code);
    else url.searchParams.delete(ROOM_PARAM);
    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, '', next);
  }, [mode, code]);

  const run = async (action: 'join' | 'create') => {
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();
    if (!trimmedName) {
      setLocalError('Enter your name.');
      return;
    }
    if (action === 'join' && !trimmedCode) {
      setLocalError('Enter the room code.');
      return;
    }
    setPending(action);
    try {
      const ack =
        action === 'create'
          ? await game.createRoom(trimmedName)
          : await game.joinRoom(trimmedCode, trimmedName);
      if (!ack.ok) setLocalError(ack.error ?? 'Could not continue.');
    } finally {
      setPending(null);
    }
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    void run('join');
  };

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    void run('create');
  };

  const message = localError ?? game.error;

  if (showRules) {
    return <Rules onBack={() => setShowRules(false)} />;
  }

  return (
    <div className="app app--solo">
      <div className="hero">
        <h1 className="hero__title">Wordt by Happy Management</h1>
        <p className="hero__tagline">Pick letters together. Make the most words.</p>
      </div>

      <button className="rules-link" type="button" onClick={() => setShowRules(true)}>
        How to play
      </button>

      {!lockedToJoin ? (
        <div className="chooser" role="tablist" aria-label="Start a game">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'join'}
            className={`chooser__tab${mode === 'join' ? ' chooser__tab--on' : ''}`}
            onClick={() => {
              setMode('join');
              setLocalError(null);
            }}
          >
            Join a room
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={`chooser__tab${mode === 'create' ? ' chooser__tab--on' : ''}`}
            onClick={() => {
              setMode('create');
              setLocalError(null);
            }}
          >
            Create a room
          </button>
        </div>
      ) : null}

      {mode === 'join' ? (
        <form className="stack" onSubmit={onJoin}>
          <label className="field">
            <span className="field__label">Room code</span>
            <input
              className="input input--code"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.toUpperCase());
                setLocalError(null);
              }}
              placeholder="ABCDE"
              maxLength={5}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="field">
            <span className="field__label">Your name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setLocalError(null);
              }}
              placeholder="e.g. Sam"
              maxLength={16}
              autoComplete="nickname"
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={pending !== null}>
            {pending === 'join' ? 'Joining…' : 'Join room'}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={onCreate}>
          <label className="field">
            <span className="field__label">Your name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setLocalError(null);
              }}
              placeholder="e.g. Sam"
              maxLength={16}
              autoComplete="nickname"
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={pending !== null}>
            {pending === 'create' ? 'Creating…' : 'Create room'}
          </button>
        </form>
      )}

      {message ? (
        <p className="hint hint--error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
