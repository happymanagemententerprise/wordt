import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import type { GameApi } from '../game';
import { loadSoloBest } from '../soloBest';
import { Rules } from './Rules';

const ROOM_PARAM = 'room';

type Mode = 'solo' | 'join' | 'create';

function codeFromUrl(): string {
  try {
    return (new URLSearchParams(window.location.search).get(ROOM_PARAM) ?? '').toUpperCase();
  } catch {
    return '';
  }
}

/** Shared name input: every way into a game needs to know who is playing. */
function NameField({
  name,
  onChange,
}: {
  name: string;
  onChange: (value: string) => void;
}): ReactNode {
  return (
    <label className="field">
      <span className="field__label">Your name</span>
      <input
        className="input"
        value={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Sam"
        maxLength={16}
        required
        autoComplete="nickname"
      />
    </label>
  );
}

/** One clearly labelled way to start playing, with its form tucked underneath. */
function ModeCard({
  mode,
  icon,
  title,
  description,
  selected,
  onSelect,
  children,
}: {
  mode: Mode;
  icon: string;
  title: string;
  description: string;
  selected: boolean;
  onSelect: (mode: Mode) => void;
  children: ReactNode;
}): ReactNode {
  return (
    <section className={`mode-card${selected ? ' mode-card--on' : ''}`}>
      <button
        type="button"
        className="mode-card__head"
        aria-label={title}
        aria-expanded={selected}
        onClick={() => onSelect(mode)}
      >
        <span className="mode-card__icon" aria-hidden="true">
          {icon}
        </span>
        <span className="mode-card__text">
          <span className="mode-card__title">{title}</span>
          <span className="mode-card__desc">{description}</span>
        </span>
        <span className="mode-card__arrow" aria-hidden="true">
          {selected ? '▾' : '›'}
        </span>
      </button>
      {selected ? <div className="mode-card__body">{children}</div> : null}
    </section>
  );
}

export function Join({ game }: { game: GameApi }): ReactNode {
  const initialCode = codeFromUrl();
  const [lockedToJoin] = useState(Boolean(initialCode));
  const [mode, setMode] = useState<Mode | null>(lockedToJoin ? 'join' : null);
  const [showRules, setShowRules] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [pending, setPending] = useState<Mode | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const soloBest = loadSoloBest();

  const updateName = (value: string) => {
    setName(value);
    setLocalError(null);
  };

  const selectMode = (next: Mode) => {
    setMode(next);
    setLocalError(null);
  };

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

  const run = async (action: Mode) => {
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
        action === 'solo'
          ? await game.createSoloRoom(trimmedName)
          : action === 'create'
            ? await game.createRoom(trimmedName)
            : await game.joinRoom(trimmedCode, trimmedName);
      if (!ack.ok) setLocalError(ack.error ?? 'Could not continue.');
    } finally {
      setPending(null);
    }
  };

  const submit = (action: Mode) => (event: FormEvent) => {
    event.preventDefault();
    void run(action);
  };

  const message = localError ?? game.error;

  if (showRules) {
    return <Rules onBack={() => setShowRules(false)} />;
  }

  return (
    <div className="app app--solo">
      <div className="hero">
        <h1 className="hero__title">Wordt</h1>
        <p className="hero__byline">by Happy Management</p>
        <p className="hero__tagline">Pick letters together. Make the most words.</p>
      </div>

      {soloBest ? (
        <div className="game-status" role="status">
          <span className="game-status__icon" aria-hidden="true">★</span>
          <span className="game-status__text">
            <strong className="game-status__score">{soloBest.score} pts</strong>
            <span className="game-status__label">
              personal best · {soloBest.rounds} {soloBest.rounds === 1 ? 'round' : 'rounds'}
            </span>
          </span>
        </div>
      ) : null}

      <button className="rules-link" type="button" onClick={() => setShowRules(true)}>
        How to play
      </button>

      <div className="mode-list" role="group" aria-label="Choose how to start">
        {lockedToJoin ? null : (
          <ModeCard
            mode="solo"
            icon="★"
            title="Solo practice"
            description="Play alone against the clock. No friends, room code or TV needed."
            selected={mode === 'solo'}
            onSelect={selectMode}
          >
            <form className="stack" onSubmit={submit('solo')}>
              <NameField name={name} onChange={updateName} />
              <button className="btn btn--primary" type="submit" disabled={pending !== null}>
                {pending === 'solo' ? 'Starting…' : 'Start practice'}
              </button>
            </form>
          </ModeCard>
        )}

        <ModeCard
          mode="join"
          icon="›"
          title="Join a room"
          description="Got a code from the TV? Join the game your host has started."
          selected={mode === 'join'}
          onSelect={selectMode}
        >
          <form className="stack" onSubmit={submit('join')}>
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
                required
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <span className="field__help">Ask your host for the code on the TV.</span>
            </label>
            <NameField name={name} onChange={updateName} />
            <button className="btn btn--primary" type="submit" disabled={pending !== null}>
              {pending === 'join' ? 'Joining…' : 'Join room'}
            </button>
          </form>
        </ModeCard>

        {lockedToJoin ? null : (
          <ModeCard
            mode="create"
            icon="+"
            title="Create a room"
            description="Host a game for friends and share the room code with them."
            selected={mode === 'create'}
            onSelect={selectMode}
          >
            <form className="stack" onSubmit={submit('create')}>
              <NameField name={name} onChange={updateName} />
              <button className="btn btn--primary" type="submit" disabled={pending !== null}>
                {pending === 'create' ? 'Creating…' : 'Create room'}
              </button>
            </form>
          </ModeCard>
        )}
      </div>

      {message ? (
        <p className="hint hint--error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
