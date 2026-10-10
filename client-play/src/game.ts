import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { OwnState, PublicRoomState } from '@wordt/shared';

const SERVER_URL: string =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin);

export interface Ack {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  outcome?: { word: string; ok: boolean; reason?: string; score?: number };
}

export interface Seat {
  roomCode: string;
  playerId: string;
  name: string;
}

export const socket: Socket = io(SERVER_URL);

const SEAT_KEY = 'wordt.seat';
const ERROR_MS = 5000;

function loadSeat(): Seat | null {
  try {
    const raw = localStorage.getItem(SEAT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Seat>;
    if (typeof parsed.roomCode !== 'string' || typeof parsed.playerId !== 'string') return null;
    return { roomCode: parsed.roomCode, playerId: parsed.playerId, name: parsed.name ?? '' };
  } catch {
    return null;
  }
}

function saveSeat(seat: Seat): void {
  localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
}

function dropSeat(): void {
  localStorage.removeItem(SEAT_KEY);
}

/** Return the phone to the home page and forget the seat. */
function returnHome(
  setSeat: (seat: Seat | null) => void,
  setState: (state: PublicRoomState | null) => void,
  setOwn: (own: OwnState | null) => void,
): void {
  dropSeat();
  setSeat(null);
  setState(null);
  setOwn(null);
}

export function ask(event: string, payload: Record<string, unknown> = {}): Promise<Ack> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'The server is not responding.' }), 8000);
    socket.emit(event, payload, (ack?: Ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, error: 'The server sent an empty reply.' });
    });
  });
}

export interface GameApi {
  connected: boolean;
  state: PublicRoomState | null;
  own: OwnState | null;
  seat: Seat | null;
  error: string | null;
  busy: boolean;
  dismissError: () => void;
  createRoom: (name: string) => Promise<Ack>;
  joinRoom: (roomCode: string, name: string, playerId?: string) => Promise<Ack>;
  start: () => Promise<Ack>;
  nextRound: () => Promise<Ack>;
  newGame: () => Promise<Ack>;
  backToLobby: () => Promise<Ack>;
  endGame: () => Promise<Ack>;
  setTeamsEnabled: (enabled: boolean) => Promise<Ack>;
  setRoundSeconds: (seconds: number) => Promise<Ack>;
  setRoundCount: (rounds: number | null) => Promise<Ack>;
  setTeam: (teamId: string) => Promise<Ack>;
  transferHost: (playerId: string) => Promise<Ack>;
  kickPlayer: (playerId: string) => Promise<Ack>;
  setPick: (letters: string[]) => Promise<Ack>;
  lockPick: () => Promise<Ack>;
  submitWord: (word: string) => Promise<Ack>;
  nextReviewStep: () => Promise<Ack>;
  leave: () => Promise<Ack>;
}

export function useGame(): GameApi {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [own, setOwn] = useState<OwnState | null>(null);
  const [seat, setSeat] = useState<Seat | null>(loadSeat);
  const [connected, setConnected] = useState(socket.connected);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const seatRef = useRef<Seat | null>(seat);
  seatRef.current = seat;
  const phaseRef = useRef<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(null), ERROR_MS);
  }, []);

  const dismissError = useCallback(() => {
    if (errorTimer.current) clearTimeout(errorTimer.current);
    setError(null);
  }, []);

  const rejoin = useCallback(() => {
    const current = seatRef.current;
    if (!current) return;
    socket.emit(
      'room:join',
      { roomCode: current.roomCode, playerId: current.playerId, name: current.name },
      (ack?: Ack) => {
        if (ack?.ok) return;
        dropSeat();
        setSeat(null);
        setState(null);
        setOwn(null);
        showError(ack?.error ?? 'That room is no longer available.');
      },
    );
  }, [showError]);

  useEffect(() => {
    const onState = (next: PublicRoomState) => {
      if (phaseRef.current !== next.phase) {
        phaseRef.current = next.phase;
        dismissError();
      }
      setState(next);
    };
    const onOwn = (next: OwnState) => setOwn(next);
    const onConnect = () => {
      setConnected(true);
      rejoin();
    };
    const onDisconnect = () => setConnected(false);
    const onRoomEnded = () => returnHome(setSeat, setState, setOwn);
    const onRoomRemoved = () => {
      showError('The host removed you from the room.');
      returnHome(setSeat, setState, setOwn);
    };

    socket.on('state', onState);
    socket.on('own', onOwn);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:ended', onRoomEnded);
    socket.on('room:removed', onRoomRemoved);
    if (socket.connected) {
      setConnected(true);
      rejoin();
    }

    return () => {
      socket.off('state', onState);
      socket.off('own', onOwn);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:ended', onRoomEnded);
      socket.off('room:removed', onRoomRemoved);
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [dismissError, rejoin, showError]);

  const adopt = useCallback((ack: Ack, name: string) => {
    if (!ack.ok || !ack.roomCode || !ack.playerId) {
      if (ack.error) showError(ack.error);
      return ack;
    }
    const next: Seat = { roomCode: ack.roomCode, playerId: ack.playerId, name };
    saveSeat(next);
    setSeat(next);
    return ack;
  }, [showError]);

  const guarded = useCallback(
    async (event: string, payload: Record<string, unknown> = {}) => {
      setBusy(true);
      try {
        const ack = await ask(event, payload);
        if (!ack.ok && ack.error) showError(ack.error);
        return ack;
      } finally {
        setBusy(false);
      }
    },
    [showError],
  );

  const createRoom = useCallback(
    async (name: string) => adopt(await ask('room:create', { name }), name),
    [adopt],
  );

  const joinRoom = useCallback(
    async (roomCode: string, name: string, playerId?: string) =>
      adopt(await ask('room:join', { roomCode, name, playerId }), name),
    [adopt],
  );

  return {
    connected,
    state,
    own,
    seat,
    error,
    busy,
    dismissError,
    createRoom,
    joinRoom,
    start: () => guarded('host:start'),
    nextRound: () => guarded('host:next'),
    newGame: () => guarded('host:start'),
    backToLobby: () => guarded('host:lobby'),
    endGame: () => guarded('host:end'),
    setTeamsEnabled: (enabled) => guarded('host:teams', { enabled }),
    setRoundSeconds: (seconds) => guarded('host:timer', { seconds }),
    setRoundCount: (rounds) => guarded('host:rounds', { rounds }),
    setTeam: (teamId) => guarded('team:set', { teamId }),
    transferHost: (playerId) => guarded('host:transfer', { playerId }),
    kickPlayer: (playerId) => guarded('host:kick', { playerId }),
    setPick: (letters) => ask('pick:set', { letters }),
    lockPick: () => guarded('pick:lock'),
    submitWord: (word) => ask('word:submit', { word }),
    nextReviewStep: () => guarded('review:next'),
    leave: async () => {
      const ack = await guarded('room:leave');
      if (ack.ok) returnHome(setSeat, setState, setOwn);
      return ack;
    },
  };
}
