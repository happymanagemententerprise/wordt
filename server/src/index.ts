import { Server, type Socket } from 'socket.io';

import { MIN_WORD_LENGTH, type JoinAck, type WordRejection } from '@wordt/shared';

import { Room, type WordOutcome } from './room';

const PORT = Number(process.env.PORT ?? 3000);
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;

interface Session {
  roomCode: string;
  playerId?: string;
  tv: boolean;
}

interface Entry {
  room: Room;
  watchers: Set<string>;
  cleanup: ReturnType<typeof setTimeout> | null;
}

interface ActionAck {
  ok: boolean;
  error?: string;
}

interface SubmitAck extends ActionAck {
  outcome?: WordOutcome;
}

type PlayerCtx =
  | { ok: true; entry: Entry; playerId: string }
  | { ok: false; error: string };

const rooms = new Map<string, Entry>();
const sessions = new Map<string, Session>();

const io = new Server(PORT, { cors: { origin: true }, serveClient: false });

io.on('error', (error: Error) => {
  console.error('[wordt] socket.io error:', error.message);
});

/** Normalises the (payload, ack) call shape so clients may omit either. */
function on<P, R>(
  socket: Socket,
  event: string,
  handler: (payload: P, ack: (res: R) => void) => void,
): void {
  socket.on(event, (first?: unknown, second?: unknown) => {
    const payload = (typeof first === 'function' ? {} : first) as P;
    const ack = (typeof first === 'function' ? first : second) as
      | ((res: R) => void)
      | undefined;
    handler(payload, typeof ack === 'function' ? ack : () => {});
  });
}

function normalizeCode(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

function connectedCount(room: Room): number {
  let count = 0;
  for (const player of room.players.values()) {
    if (player.connected) count += 1;
  }
  return count;
}

function clearCleanup(entry: Entry): void {
  if (entry.cleanup) {
    clearTimeout(entry.cleanup);
    entry.cleanup = null;
  }
}

function isFree(entry: Entry): boolean {
  return connectedCount(entry.room) === 0 && entry.watchers.size === 0;
}

function maybeCleanup(code: string, entry: Entry): void {
  if (!isFree(entry)) {
    clearCleanup(entry);
    return;
  }
  if (entry.cleanup) return;
  entry.cleanup = setTimeout(() => {
    const current = rooms.get(code);
    if (!current || !isFree(current)) {
      if (current) current.cleanup = null;
      return;
    }
    rooms.delete(code);
    current.room.destroy();
    console.log(`[wordt] room ${code} expired`);
  }, EMPTY_ROOM_TTL_MS);
}

/** Pull a socket out of its current room. `sameSeat` keeps the player connected. */
function detach(socket: Socket, sameSeat = false): void {
  const session = sessions.get(socket.id);
  if (!session) return;
  sessions.delete(socket.id);
  socket.leave(session.roomCode);
  const entry = rooms.get(session.roomCode);
  if (entry) {
    if (session.tv) entry.watchers.delete(socket.id);
    else if (session.playerId && !sameSeat) entry.room.disconnect(session.playerId);
    maybeCleanup(session.roomCode, entry);
  }
}

function requirePlayer(socket: Socket): PlayerCtx {
  const session = sessions.get(socket.id);
  if (!session?.playerId) return { ok: false, error: 'Only players can do that.' };
  const entry = rooms.get(session.roomCode);
  if (!entry) return { ok: false, error: 'That room no longer exists.' };
  return { ok: true, entry, playerId: session.playerId };
}

function rejectionMessage(reason: WordRejection | undefined): string {
  switch (reason) {
    case 'TOO_SHORT':
      return `Too short — words need at least ${MIN_WORD_LENGTH} letters.`;
    case 'UNUSABLE_LETTER':
      return 'That letter was not picked by two or more players.';
    case 'DUPLICATE':
      return 'You already submitted that word.';
    default:
      return 'Not in the dictionary.';
  }
}

function makeCode(taken: Map<string, Entry>): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i += 1) {
      code += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    if (!taken.has(code)) return code;
  }
}

io.on('connection', (socket: Socket) => {
  on<{ name?: string }, JoinAck>(socket, 'room:create', (payload, ack) => {
    detach(socket);
    const code = makeCode(rooms);
    const entry: Entry = { room: new Room(io, code), watchers: new Set(), cleanup: null };
    rooms.set(code, entry);

    socket.join(code);
    const player = entry.room.join(socket.id, String(payload?.name ?? ''));
    if (!player) {
      socket.leave(code);
      rooms.delete(code);
      entry.room.destroy();
      ack({ ok: false, error: 'Could not create a room.' });
      return;
    }

    sessions.set(socket.id, { roomCode: code, playerId: player.id, tv: false });
    ack({ ok: true, roomCode: code, playerId: player.id });
    entry.room.emitState();
    entry.room.emitOwn(player.id);
    console.log(`[wordt] room ${code} created by ${player.name}`);
  });

  on<{ roomCode?: string; name?: string; playerId?: string }, JoinAck>(
    socket,
    'room:join',
    (payload, ack) => {
      const code = normalizeCode(payload?.roomCode);
      const entry = rooms.get(code);
      if (!entry) {
        ack({ ok: false, error: 'Room not found.' });
        return;
      }

      // Kick a stale socket still holding this seat (double tab, reconnect race).
      const returning = payload?.playerId
        ? entry.room.players.get(payload.playerId)
        : undefined;
      const staleId = returning?.socketId;
      if (staleId && staleId !== socket.id) {
        io.sockets.sockets.get(staleId)?.leave(code);
        sessions.delete(staleId);
      }

      const previous = sessions.get(socket.id);
      const sameSeat =
        previous?.roomCode === code && previous.playerId === payload?.playerId;
      detach(socket, sameSeat);
      socket.join(code);

      const player = entry.room.join(
        socket.id,
        String(payload?.name ?? ''),
        payload?.playerId,
      );
      if (!player) {
        socket.leave(code);
        const error =
          entry.room.phase === 'LOBBY'
            ? 'That room is full.'
            : 'That game has already started.';
        ack({ ok: false, error });
        return;
      }

      sessions.set(socket.id, { roomCode: code, playerId: player.id, tv: false });
      clearCleanup(entry);
      ack({ ok: true, roomCode: code, playerId: player.id });
      entry.room.emitState();
      entry.room.emitOwn(player.id);
    },
  );

  on<{ roomCode?: string }, JoinAck>(socket, 'tv:watch', (payload, ack) => {
    const code = normalizeCode(payload?.roomCode);
    const entry = rooms.get(code);
    if (!entry) {
      ack({ ok: false, error: 'Room not found.' });
      return;
    }

    detach(socket);
    socket.join(code);
    sessions.set(socket.id, { roomCode: code, tv: true });
    entry.watchers.add(socket.id);
    clearCleanup(entry);
    ack({ ok: true, roomCode: code });
    socket.emit('state', entry.room.publicState());
  });

  // ----------------------------------------------------------- host controls

  on<Record<string, never>, ActionAck>(socket, 'host:start', (_payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    const room = ctx.entry.room;
    if (room.host?.id !== ctx.playerId) {
      ack({ ok: false, error: 'Only the host can start the game.' });
      return;
    }
    if (room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER') {
      ack({ ok: false, error: 'The game is already running.' });
      return;
    }
    if (connectedCount(room) < 2) {
      ack({ ok: false, error: 'At least two players must be connected.' });
      return;
    }
    ack({ ok: room.startGame(ctx.playerId) });
  });

  on<Record<string, never>, ActionAck>(socket, 'host:next', (_payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    const room = ctx.entry.room;
    if (room.host?.id !== ctx.playerId) {
      ack({ ok: false, error: 'Only the host can continue.' });
      return;
    }
    if (room.phase !== 'RESULTS') {
      ack({ ok: false, error: 'The current round is not finished.' });
      return;
    }
    ack({ ok: room.startNextRound(ctx.playerId) });
  });

  on<Record<string, never>, ActionAck>(socket, 'host:lobby', (_payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    if (ctx.entry.room.host?.id !== ctx.playerId) {
      ack({ ok: false, error: 'Only the host can do that.' });
      return;
    }
    if (!ctx.entry.room.returnToLobby(ctx.playerId)) {
      ack({ ok: false, error: 'The match is not over yet.' });
      return;
    }
    ack({ ok: true });
  });

  on<Record<string, never>, ActionAck>(socket, 'host:end', (_payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    if (ctx.entry.room.host?.id !== ctx.playerId) {
      ack({ ok: false, error: 'Only the host can do that.' });
      return;
    }
    if (!ctx.entry.room.endGame(ctx.playerId)) {
      ack({ ok: false, error: 'There is no game running right now.' });
      return;
    }
    ack({ ok: true });
  });

  on<{ enabled?: unknown }, ActionAck>(socket, 'host:teams', (payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    if (ctx.entry.room.host?.id !== ctx.playerId) {
      ack({ ok: false, error: 'Only the host can do that.' });
      return;
    }
    const enabled = Boolean(payload?.enabled);
    if (!ctx.entry.room.setTeamsEnabled(ctx.playerId, enabled)) {
      ack({ ok: false, error: 'Teams can only be changed in the lobby.' });
      return;
    }
    ack({ ok: true });
  });

  on<{ teamId?: unknown }, ActionAck>(socket, 'team:set', (payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    const teamId = typeof payload?.teamId === 'string' ? payload.teamId : '';
    if (!ctx.entry.room.setTeam(ctx.playerId, teamId)) {
      ack({ ok: false, error: 'That team is full or teams are not open.' });
      return;
    }
    ack({ ok: true });
  });

  on<Record<string, never>, ActionAck>(socket, 'review:next', (payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    if (ctx.entry.room.host?.id !== ctx.playerId) {
      ack({ ok: false, error: 'Only the host can skip this step.' });
      return;
    }
    ack({ ok: ctx.entry.room.advanceReview(ctx.playerId) });
  });

  // --------------------------------------------------------------- gameplay

  on<{ letters?: unknown }, ActionAck>(socket, 'pick:set', (payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    const raw = Array.isArray(payload?.letters) ? payload.letters : [];
    const letters = raw.slice(0, 40).map((letter) => String(letter));
    ctx.entry.room.setPick(ctx.playerId, letters);
    ack({ ok: true });
  });

  on<Record<string, never>, ActionAck>(socket, 'pick:lock', (_payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    if (!ctx.entry.room.lockPick(ctx.playerId)) {
      ack({ ok: false, error: 'Picking is not open right now.' });
      return;
    }
    ack({ ok: true });
  });

  on<{ word?: unknown }, SubmitAck>(socket, 'word:submit', (payload, ack) => {
    const ctx = requirePlayer(socket);
    if (!ctx.ok) {
      ack(ctx);
      return;
    }
    const raw = typeof payload?.word === 'string' ? payload.word.slice(0, 40) : '';
    if (raw.trim() === '') {
      ack({ ok: false, error: 'Type a word first.' });
      return;
    }
    const outcome = ctx.entry.room.submitWord(ctx.playerId, raw);
    if (!outcome) {
      ack({ ok: false, error: 'The word phase is not running right now.' });
      return;
    }
    if (!outcome.ok) {
      ack({ ok: false, error: rejectionMessage(outcome.reason), outcome });
      return;
    }
    ack({ ok: true, outcome });
  });

  socket.on('disconnect', () => {
    detach(socket);
  });
});

console.log(`[wordt] server listening on http://localhost:${PORT}`);

process.on('SIGINT', () => {
  io.close(() => process.exit(0));
});
process.on('SIGTERM', () => {
  io.close(() => process.exit(0));
});
