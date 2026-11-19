import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GameApi } from '../game';
import { Join } from './Join';

function makeGame(): GameApi {
  return {
    createSoloRoom: vi.fn().mockResolvedValue({ ok: true }),
    createRoom: vi.fn().mockResolvedValue({ ok: true }),
    joinRoom: vi.fn().mockResolvedValue({ ok: true }),
    error: null,
  } as unknown as GameApi;
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('home screen start choices', () => {
  it('shows the personal best as a game status', () => {
    window.localStorage.setItem(
      'wordt.solo.best',
      JSON.stringify({ score: 88, rounds: 3, at: '2026-01-01T00:00:00.000Z' }),
    );
    render(<Join game={makeGame()} />);

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('88 pts');
    expect(status.textContent).toContain('personal best');
  });

  it('shows solo, join and create as separate described choices', () => {
    render(<Join game={makeGame()} />);

    expect(screen.getByText('Play alone against the clock. No friends, room code or TV needed.')).toBeTruthy();
    expect(screen.getByText('Got a code from the TV? Join the game your host has started.')).toBeTruthy();
    expect(screen.getByText('Host a game for friends and share the room code with them.')).toBeTruthy();
    expect(screen.queryByPlaceholderText('e.g. Sam')).toBeNull();
  });

  it('reveals the solo form only for the selected choice and starts practice', async () => {
    const game = makeGame();
    render(<Join game={game} />);

    const solo = screen.getByRole('button', { name: 'Solo practice' });
    fireEvent.click(solo);
    expect(solo.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Join a room' }).getAttribute('aria-expanded')).toBe('false');

    fireEvent.change(screen.getByPlaceholderText('e.g. Sam'), { target: { value: 'Sam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));

    await waitFor(() => expect(game.createSoloRoom).toHaveBeenCalledWith('Sam'));
    expect(game.joinRoom).not.toHaveBeenCalled();
  });

  it('starts a party room from the create choice', async () => {
    const game = makeGame();
    render(<Join game={game} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create a room' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Sam'), { target: { value: 'Alex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create room' }));

    await waitFor(() => expect(game.createRoom).toHaveBeenCalledWith('Alex'));
    expect(game.createSoloRoom).not.toHaveBeenCalled();
  });

  it('opens straight to the join form when a room code is in the URL', () => {
    window.history.replaceState(null, '', '/?room=ABC12');
    render(<Join game={makeGame()} />);

    expect(screen.queryByRole('button', { name: 'Solo practice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create a room' })).toBeNull();
    expect(screen.getByDisplayValue('ABC12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Join a room' }).getAttribute('aria-expanded')).toBe('true');
  });
});
