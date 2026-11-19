import type { Server } from 'socket.io';
import { afterEach, describe, expect, it } from 'vitest';

import { Room } from '../src/room';

let opened: Room[] = [];

function makeRoom(solo: boolean): Room {
  const io = { to: () => ({ emit: () => {} }) } as unknown as Server;
  const room = new Room(io, 'ABCDE', solo);
  opened.push(room);
  return room;
}

afterEach(() => {
  for (const room of opened) room.destroy();
  opened = [];
});

describe('solo practice rooms', () => {
  it('advertises solo mode in the public state', () => {
    const room = makeRoom(true);
    expect(room.publicState().solo).toBe(true);
    expect(makeRoom(false).publicState().solo).toBe(false);
  });

  it('lets a lone player start a game', () => {
    const room = makeRoom(true);
    const player = room.join('socket-1', 'Sam')!;
    room.setWordSeconds(player.id, 60);

    expect(room.startGame(player.id)).toBe(true);
    expect(room.phase).toBe('PICKING');
    expect(room.publicState().round).toBe(1);
  });

  it('still requires two connected players for a party room', () => {
    const room = makeRoom(false);
    const player = room.join('socket-1', 'Sam')!;
    room.setWordSeconds(player.id, 60);

    expect(room.startGame(player.id)).toBe(false);
    expect(room.phase).toBe('LOBBY');
  });

  it('keeps teams off in solo practice', () => {
    const room = makeRoom(true);
    const player = room.join('socket-1', 'Sam')!;

    expect(room.setTeamsEnabled(player.id, true)).toBe(false);
    expect(room.publicState().teamsEnabled).toBe(false);
  });

  it('gives the lone player the full 15-letter share', () => {
    const room = makeRoom(true);
    const player = room.join('socket-1', 'Sam')!;
    room.setWordSeconds(player.id, 60);
    room.startGame(player.id);

    expect(room.publicState().players[0]?.pickLimit).toBe(15);
  });
});
