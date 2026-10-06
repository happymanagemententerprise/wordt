import { useState, type FormEvent, type ReactNode } from 'react';

import type { GameApi } from '../game';

export function Join({ game }: { game: GameApi }): ReactNode {
  const [name, setName] = useState('');
  const [code, setCode] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('room');
    return fromUrl ? fromUrl.trim().toUpperCase() : '';
  });
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedCode = code.trim().toUpperCase();
  const canCreate = trimmedName.length > 0 && pending === null;
  const canJoin = canCreate && trimmedCode.length >= 4;

  const run = async (action: 'create' | 'join') => {
    if (action === 'create' ? !canCreate : !canJoin) return;
    setLocalError(null);
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

  const onCreate = (event: FormEvent) => {
    event.preventDefault();
    void run('create');
  };

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    void run('join');
  };

  const message = localError ?? game.error;

  return (
    <div className="app app--solo">
      <div className="hero">
        <h1 className="hero__title">Wordt</h1>
        <p className="hero__tagline">Pick letters together. Make the most words.</p>
      </div>

      <label className="field">
        <span className="field__label">Your name</span>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Sam"
          maxLength={16}
          autoComplete="nickname"
        />
      </label>

      <form className="stack" onSubmit={onCreate}>
        <button className="btn btn--primary" type="submit" disabled={!canCreate}>
          {pending === 'create' ? 'Working…' : 'Create a room'}
        </button>
      </form>

      <div className="divider"><span>or join a room</span></div>

      <label className="field">
        <span className="field__label">Room code</span>
        <input
          className="input input--code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABCDE"
          maxLength={5}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>

      <form className="stack" onSubmit={onJoin}>
        <button className="btn" type="submit" disabled={!canJoin}>
          {pending === 'join' ? 'Working…' : 'Join room'}
        </button>
      </form>

      {message ? (
        <p className="hint hint--error" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
