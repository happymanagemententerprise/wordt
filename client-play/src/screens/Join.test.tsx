import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { GameApi } from '../game';
import { Join } from './Join';

function makeGame(): GameApi {
  return {
    createSoloRoom: vi.fn().mockResolvedValue({ ok: true }),
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    error: null,
  } as unknown as GameApi;
}

describe('solo practice entry', () => {
  it('starts a private one-player room from the home screen', async () => {
    const game = makeGame();
    render(<Join game={game} />);

    fireEvent.click(screen.getByRole('button', { name: 'Solo practice' }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Sam'), {
      target: { value: 'Sam' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }));

    await waitFor(() => expect(game.createSoloRoom).toHaveBeenCalledWith('Sam'));
    expect(game.joinRoom).not.toHaveBeenCalled();
  });
});
