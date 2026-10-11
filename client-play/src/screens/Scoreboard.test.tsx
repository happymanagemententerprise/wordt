import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { GameApi } from '../game';
import { Scoreboard } from './Scoreboard';

afterEach(() => {
  window.matchMedia = undefined as unknown as typeof window.matchMedia;
});

function makeGame(
  rows: { name: string; score: number; validWordCount: number }[],
  ownId = 'p0',
): GameApi {
  const standings = rows.map((r) => ({
    id: r.name.toLowerCase().replace(/\s+/g, '-'),
    name: r.name,
    score: r.score,
    validWordCount: r.validWordCount,
    totalTries: r.validWordCount,
    connected: true,
    isHost: false,
    teamId: null,
  }));

  return {
    state: {
      phase: 'GAME_OVER',
      round: 3,
      teamsEnabled: false,
      standings,
      finalStandings: standings,
      lastRoundResult: null,
    },
    own: { id: ownId, isHost: true, teamId: null },
    busy: false,
  } as unknown as GameApi;
}

describe('Scoreboard final celebration', () => {
  it('gives first place the gold figure, second silver, third bronze, and fourth nothing', () => {
    const { container } = render(
      <Scoreboard
        game={makeGame([
          { name: 'Ada', score: 30, validWordCount: 6 },
          { name: 'Bo', score: 20, validWordCount: 5 },
          { name: 'Cy', score: 12, validWordCount: 4 },
          { name: 'Di', score: 4, validWordCount: 2 },
        ])}
        final
      />,
    );

    expect(container.querySelectorAll('.winner-figure')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /first place champion/i })).toBeTruthy();
    expect(screen.getByRole('img', { name: /silver medal/i })).toBeTruthy();
    expect(screen.getByRole('img', { name: /bronze medal/i })).toBeTruthy();
    expect(container.querySelectorAll('.standing-medal')).toHaveLength(2);

    const rows = container.querySelectorAll('.standing');
    const fourth = rows[3];
    expect(fourth?.querySelector('.standing__celebrate')).toBeNull();
    expect(fourth?.querySelector('.standing-medal')).toBeNull();
  });

  it('gives every tied first-place row the gold treatment', () => {
    const { container } = render(
      <Scoreboard
        game={makeGame([
          { name: 'Ada', score: 25, validWordCount: 5 },
          { name: 'Bo', score: 25, validWordCount: 5 },
          { name: 'Cy', score: 9, validWordCount: 3 },
          { name: 'Di', score: 4, validWordCount: 2 },
        ])}
        final
      />,
    );

    expect(container.querySelectorAll('.winner-figure')).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: /first place champion/i })).toHaveLength(2);
    expect(screen.getByRole('img', { name: /silver medal/i })).toBeTruthy();
    expect(screen.getByRole('img', { name: /bronze medal/i })).toBeTruthy();
  });

  it('renders the static final state for reduced motion', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('reduced-motion'),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;

    const { container } = render(
      <Scoreboard
        game={makeGame([
          { name: 'Ada', score: 30, validWordCount: 6 },
          { name: 'Bo', score: 20, validWordCount: 5 },
        ])}
        final
      />,
    );

    const figure = container.querySelector('.winner-figure');
    const medal = container.querySelector('.standing-medal');
    expect(figure?.classList.contains('winner-figure--static')).toBe(true);
    expect(figure?.classList.contains('winner-figure--intro')).toBe(false);
    expect(medal?.classList.contains('standing-medal--static')).toBe(true);
    expect(medal?.classList.contains('standing-medal--pop')).toBe(false);
  });

  it('animates the champion on first appearance when motion is allowed', () => {
    const { container } = render(
      <Scoreboard game={makeGame([{ name: 'Ada', score: 30, validWordCount: 6 }])} final />,
    );

    const figure = container.querySelector('.winner-figure');
    expect(figure?.classList.contains('winner-figure--intro')).toBe(true);
    expect(figure?.classList.contains('winner-figure--static')).toBe(false);
  });
});
