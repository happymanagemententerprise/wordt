import { useEffect, useRef, useState, type ReactNode } from 'react';

import { LETTER_POOL } from '@wordt/shared';

import type { GameApi } from '../game';
import { Countdown } from '../ui';

const ALPHABET = [...LETTER_POOL];

function sameList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const other = new Set(b);
  return a.every((letter) => other.has(letter));
}

/**
 * The server echoes the cleaned pick after every change. While our own edit is
 * still in flight we ignore those echoes — otherwise a slow reply for an
 * earlier tap would visually undo a later one. The lock releases as soon as an
 * echo catches up, which also lets a reconnect bring the authoritative pick back.
 */
export function Pick({ game }: { game: GameApi }): ReactNode {
  const state = game.state;
  const own = game.own;
  const [selected, setSelected] = useState<string[]>(() => own?.pick ?? []);
  const awaitingEcho = useRef(false);

  useEffect(() => {
    if (!game.connected) awaitingEcho.current = false;
  }, [game.connected]);

  useEffect(() => {
    if (!own) return;
    if (awaitingEcho.current) {
      if (sameList(own.pick, selected)) awaitingEcho.current = false;
      return;
    }
    setSelected(own.pick);
  }, [own, selected]);

  if (!state || !own) return null;

  // Letters a teammate already claimed; the team's draft must not overlap.
  const teammatePicks = new Set(
    own.teamId
      ? state.players
          .filter((player) => player.id !== own.id && player.teamId === own.teamId)
          .flatMap((player) => player.pick)
      : [],
  );

  const toggle = (letter: string) => {
    if (own.pickedLocked || teammatePicks.has(letter)) return;
    const next = selected.includes(letter)
      ? selected.filter((picked) => picked !== letter)
      : selected.length < own.pickLimit
        ? [...selected, letter]
        : selected;
    if (sameList(next, selected)) return;
    awaitingEcho.current = true;
    setSelected(next);
    void game.setPick(next);
  };

  const lockedCount = state.players.filter((player) => player.pickedLocked).length;
  const readyCount = own.teamId
    ? state.players.filter((player) => player.teamId === own.teamId && player.pickedLocked).length +
      '/' +
      state.players.filter((player) => player.teamId === own.teamId).length +
      ' teammates ready'
    : `${lockedCount} of ${state.players.length} players ready`;

  return (
    <section className="screen">
      <div className="screen__head">
        <div>
          <h2>Pick your letters</h2>
          <p className="hint">
            {own.teamId
              ? 'Your team picks ten letters between you, so no one grabs the same one.'
              : 'Letters picked by two or more players become usable.'}
          </p>
        </div>
        <Countdown endsAt={state.phaseEndsAt} />
      </div>

      <p className="tally">
        <strong>{selected.length}</strong> / {own.pickLimit} selected
      </p>

      <div className={`keyboard${own.pickedLocked ? ' keyboard--locked' : ''}`}>
        {ALPHABET.map((letter) => {
          const active = selected.includes(letter);
          const blocked = teammatePicks.has(letter);
          return (
            <button
              key={letter}
              type="button"
              className={`key${active ? ' key--on' : ''}${blocked ? ' key--teammate' : ''}`}
              disabled={own.pickedLocked || blocked || (!active && selected.length >= own.pickLimit)}
              aria-pressed={active}
              onClick={() => toggle(letter)}
            >
              {letter}
            </button>
          );
        })}
      </div>

      <div className="actions">
        {own.pickedLocked ? (
          <p className="locked">Locked in · {readyCount}</p>
        ) : (
          <button className="btn btn--primary" type="button" onClick={() => void game.lockPick()}>
            Lock in my letters
          </button>
        )}
      </div>
    </section>
  );
}
