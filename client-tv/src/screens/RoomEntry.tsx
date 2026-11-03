import { useState, type FormEvent, type ReactNode } from 'react';

export function RoomEntry({
  error,
  onHowToPlay,
  onSubmit,
}: {
  error: string | null;
  onHowToPlay: () => void;
  onSubmit: (code: string) => void;
}): ReactNode {
  const [code, setCode] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) onSubmit(clean);
  };

  return (
    <div className="tv-solo">
      <div className="tv-brand-lockup">
        <h1 className="tv-brand tv-brand--hero">Wordt</h1>
        <p className="tv-brand-byline">by Happy Management</p>
      </div>
      <p className="tv-lead">Enter the room code shown on the host's phone.</p>
      <form className="tv-entry" onSubmit={submit}>
        <label className="tv-entry__field">
          <span>Room code</span>
          <input
            className="tv-entry__input"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABCDE"
            maxLength={8}
            autoComplete="off"
            spellCheck={false}
            autoFocus
          />
        </label>
        <button className="tv-btn" type="submit" disabled={code.trim().length === 0}>
          Watch
        </button>
      </form>
      {error ? <p className="tv-error">{error}</p> : null}
      <button className="tv-link" type="button" onClick={onHowToPlay}>
        How to play
      </button>
    </div>
  );
}
