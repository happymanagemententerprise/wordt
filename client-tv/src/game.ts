import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import type { PublicRoomState } from '@wordt/shared';

const SERVER_URL: string = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000';

export const socket: Socket = io(SERVER_URL);

export interface Ack {
  ok: boolean;
  error?: string;
  roomCode?: string;
}

/** The phone client the lobby QR code should point at. */
export const PLAY_URL: string = import.meta.env.VITE_PLAY_URL ?? 'http://localhost:5173';

function roomFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get('room') ?? window.location.hash.slice(1)).trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(raw) ? raw : null;
}

function remember(code: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  window.history.replaceState({}, '', url);
}

function forget(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}

export interface TvApi {
  connected: boolean;
  watching: boolean;
  state: PublicRoomState | null;
  roomCode: string | null;
  error: string | null;
  watch: (code: string) => Promise<void>;
}

export function useTv(): TvApi {
  const [state, setState] = useState<PublicRoomState | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [roomCode, setRoomCode] = useState<string | null>(roomFromUrl);
  const [error, setError] = useState<string | null>(null);

  const codeRef = useRef<string | null>(roomCode);
  codeRef.current = roomCode;

  const watch = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    const reply = await new Promise<Ack>((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'The server is not responding.' }), 8000);
      socket.emit('tv:watch', { roomCode: clean }, (ack?: Ack) => {
        clearTimeout(timer);
        resolve(ack ?? { ok: false, error: 'The server sent an empty reply.' });
      });
    });
    if (!reply.ok) {
      setError(reply.error ?? 'That room could not be found.');
      setRoomCode(null);
      setState(null);
      return;
    }
    const joined = reply.roomCode ?? clean;
    setError(null);
    setRoomCode(joined);
    remember(joined);
  }, []);

  const rewatch = useCallback(() => {
    const code = codeRef.current;
    if (code) void watch(code);
  }, [watch]);

  useEffect(() => {
    const onState = (next: PublicRoomState) => setState(next);
    const onConnect = () => {
      setConnected(true);
      rewatch();
    };
    const onDisconnect = () => setConnected(false);
    const onRoomEnded = () => {
      setError('That room ended, so the big screen was released.');
      setRoomCode(null);
      setState(null);
      forget();
    };

    socket.on('state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:ended', onRoomEnded);
    if (socket.connected) {
      setConnected(true);
      rewatch();
    }
    return () => {
      socket.off('state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:ended', onRoomEnded);
    };
  }, [rewatch]);

  return { connected, watching: roomCode !== null, state, roomCode, error, watch };
}
