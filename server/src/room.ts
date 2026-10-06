import type { Server } from 'socket.io';

import {
  ALLOW_LETTER_REUSE_IN_WORD,
  LETTERS_PER_PLAYER_MORE,
  LETTERS_PER_PLAYER_TWO,
  LETTER_POOL,
  MIN_WORD_LENGTH,
  PICK_PHASE_SECONDS,
  ROUNDS,
  REVIEW_STEP_SECONDS,
  VALUE_REVEAL_SECONDS,
  WORD_PHASE_SECONDS,
  computeLetterValues,
  countPick,
  scoreRound,
  validateWord,
  normalizeWord,
} from '@wordt/shared';
import type {
  Letter,
  LetterValueTable,
  OwnState,
  Phase,
  PlayerId,
  PublicRoomState,
  ReviewStep,
  RoundPlayerInput,
  RoundResult,
  StatAward,
  ValidationResult,
  WordCheckContext,
  WordRejection,
} from '@wordt/shared';
import { loadDictionary } from '@wordt/shared/dictionary';

const DICTIONARY = loadDictionary();

/** Phase durations in seconds. Env vars exist only so demos and smoke tests can
 *  run faster than a real party would; the shared config stays the default. */
function envSeconds(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw == null ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const PICK_SECONDS = envSeconds('WORDT_PICK_SECONDS', PICK_PHASE_SECONDS);
const WORD_SECONDS = envSeconds('WORDT_WORD_SECONDS', WORD_PHASE_SECONDS);
const REVEAL_SECONDS = envSeconds('WORDT_VALUE_REVEAL_SECONDS', VALUE_REVEAL_SECONDS);
const REVIEW_SECONDS = envSeconds('WORDT_REVIEW_STEP_SECONDS', REVIEW_STEP_SECONDS);


export interface WordOutcome {
  word: string;
  ok: boolean;
  reason?: WordRejection;
  score?: number;
}

export interface RoomPlayer {
  id: PlayerId;
  name: string;
  socketId: string | null;
  connected: boolean;
  joinedAt: number;
  isHost: boolean;
  pick: Letter[];
  pickLocked: boolean;
  validWords: string[];
  wrongTries: number;
  totalTries: number;
  score: number;
  lifetimeValidWords: number;
}

function makeRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Authoritative room. Every rule transition and every score originates here;
 * clients only render state and send intents.
 */
export class Room {
  readonly code: string;
  phase: Phase = 'LOBBY';
  round = 0;
  phaseEndsAt: number | null = null;
  letterValues: LetterValueTable | null = null;
  lastRoundResult: RoundResult | null = null;
  notice: string | null = null;
  reviewSteps: ReviewStep[] = [];
  reviewIndex = 0;
  pickLimit = LETTERS_PER_PLAYER_TWO;

  readonly players = new Map<PlayerId, RoomPlayer>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly io: Server;
  private destroyed = false;

  constructor(io: Server, code = makeRoomCode()) {
    this.io = io;
    this.code = code;
  }

  // ---------------------------------------------------------------- joining

  get host(): RoomPlayer | null {
    for (const player of this.players.values()) {
      if (player.isHost && player.connected) return player;
    }
    return null;
  }

  join(socketId: string, requestedName: string, existingId?: PlayerId): RoomPlayer | null {
    // A returning player reclaims their seat by presenting a known id.
    if (existingId) {
      const existing = this.players.get(existingId);
      if (existing) {
        existing.socketId = socketId;
        existing.connected = true;
        if (!existing.isHost && !this.host) existing.isHost = true;
        return existing;
      }
    }

    // New players may only arrive while the lobby is open.
    if (this.phase !== 'LOBBY') return null;
    if (this.players.size >= 16) return null;

    const id = existingId ?? `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const player: RoomPlayer = {
      id,
      name: requestedName.trim().slice(0, 16) || `Player ${this.players.size + 1}`,
      socketId,
      connected: true,
      joinedAt: Date.now(),
      isHost: this.players.size === 0,
      pick: [],
      pickLocked: false,
      validWords: [],
      wrongTries: 0,
      totalTries: 0,
      score: 0,
      lifetimeValidWords: 0,
    };
    this.players.set(id, player);
    return player;
  }

  disconnect(playerId: PlayerId): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.connected = false;
    player.socketId = null;

    if (player.isHost) {
      player.isHost = false;
      this.promoteHost();
    }
    this.emitState();
  }

  private promoteHost(): void {
    const next = [...this.players.values()]
      .filter((p) => p.connected)
      .sort((a, b) => a.joinedAt - b.joinedAt)[0];
    if (next) next.isHost = true;
  }

  // --------------------------------------------------------------- controls

  /** Host-only. Requires at least two connected players. */
  startGame(playerId: PlayerId): boolean {
    if (this.phase !== 'LOBBY' && this.phase !== 'GAME_OVER') return false;
    if (this.host?.id !== playerId) return false;
    if ([...this.players.values()].filter((p) => p.connected).length < 2) return false;

    this.round = 0;
    for (const player of this.players.values()) {
      player.score = 0;
      player.lifetimeValidWords = 0;
    }
    this.beginRound();
    return true;
  }

  startNextRound(playerId: PlayerId): boolean {
    if (this.phase !== 'RESULTS') return false;
    if (this.host?.id !== playerId) return false;
    if (this.round >= ROUNDS) return false;
    this.beginRound();
    return true;
  }

  /** Host-only. Back to the lobby so a fresh match can be started. */
  returnToLobby(playerId: PlayerId): boolean {
    if (this.phase !== 'GAME_OVER' && this.phase !== 'RESULTS') return false;
    if (this.host?.id !== playerId) return false;

    this.clearTimer();
    this.phase = 'LOBBY';
    this.phaseEndsAt = null;
    this.round = 0;
    this.notice = null;
    this.lastRoundResult = null;
    this.letterValues = null;
    this.reviewSteps = [];
    this.reviewIndex = 0;

    for (const player of this.players.values()) {
      player.pick = [];
      player.pickLocked = false;
      player.validWords = [];
      player.wrongTries = 0;
      player.totalTries = 0;
      player.score = 0;
      player.lifetimeValidWords = 0;
    }

    this.emitState();
    this.emitOwn();
    return true;
  }

  private beginRound(): void {
    this.round += 1;
    this.lastRoundResult = null;
    this.notice = null;
    this.reviewSteps = [];
    this.reviewIndex = 0;
    this.letterValues = null;
    this.pickLimit =
      this.players.size >= 3 ? LETTERS_PER_PLAYER_MORE : LETTERS_PER_PLAYER_TWO;

    for (const player of this.players.values()) {
      player.pick = [];
      player.pickLocked = false;
      player.validWords = [];
      player.wrongTries = 0;
      player.totalTries = 0;
    }

    this.setPhase('PICKING', PICK_SECONDS, () => this.finishPicking());
    this.emitState();
    this.emitOwn();
  }

  /** Host may cut the review short. */
  advanceReview(playerId: PlayerId): boolean {
    if (this.phase !== 'REVIEW') return false;
    if (this.host?.id !== playerId) return false;
    this.stepReview();
    return true;
  }

  // ------------------------------------------------------------------ picks

  setPick(playerId: PlayerId, letters: Letter[]): void {
    if (this.phase !== 'PICKING') return;
    const player = this.players.get(playerId);
    if (!player || player.pickLocked) return;

    const cleaned = [...new Set(letters.map((l) => String(l).toUpperCase()))]
      .filter((l) => LETTER_POOL.includes(l))
      .slice(0, this.pickLimit);

    player.pick = cleaned;
    this.emitOwn(playerId);
    this.emitState();
  }

  lockPick(playerId: PlayerId): boolean {
    if (this.phase !== 'PICKING') return false;
    const player = this.players.get(playerId);
    if (!player) return false;
    player.pickLocked = true;
    this.emitState();

    // Everyone locked => the phase can close early.
    if ([...this.players.values()].every((p) => p.pickLocked)) {
      this.clearTimer();
      this.finishPicking();
    }
    return true;
  }

  private finishPicking(): void {
    const picks = [...this.players.values()].map((player) => {
      player.pickLocked = true;
      return player.pick;
    });

    const counts = countPick(picks);
    this.letterValues = computeLetterValues(counts);

    if (this.letterValues.entries.length === 0) {
      this.notice = 'No letter was picked by two or more players, so there are no usable letters. The word phase is skipped.';
      this.letterValues = { entries: [], values: {}, counts: {} };
      this.setPhase('NOTICE', REVEAL_SECONDS, () => this.scoreAndReview());
      this.emitState();
      this.emitOwn();
      return;
    }

    this.setPhase('VALUE_TABLE', REVEAL_SECONDS, () => this.beginWordPhase());
    this.emitState();
    this.emitOwn();
  }

  private beginWordPhase(): void {
    this.setPhase('WORDS', WORD_SECONDS, () => this.scoreAndReview());
    this.emitState();
    this.emitOwn();
  }

  // ------------------------------------------------------------------ words

  submitWord(playerId: PlayerId, rawWord: string): WordOutcome | null {
    if (this.phase !== 'WORDS') return null;
    const player = this.players.get(playerId);
    if (!player || !this.letterValues) return null;

    const word = normalizeWord(rawWord);
    const context: WordCheckContext = {
      dictionary: DICTIONARY,
      usableLetters: new Set(this.letterValues.entries.map((e) => e.letter)),
      letterCounts: this.letterValues.counts,
      minLength: MIN_WORD_LENGTH,
      allowReuse: ALLOW_LETTER_REUSE_IN_WORD,
    };

    const already = new Set(player.validWords);
    const result: ValidationResult = validateWord(word, context, already);

    if (result.ok) {
      const score = [...word].reduce(
        (sum, letter) => sum + (this.letterValues?.values[letter] ?? 0),
        0,
      );
      player.validWords.push(word);
      player.totalTries += 1;
      player.lifetimeValidWords += 1;
      this.emitState();
      this.emitOwn(playerId);
      return { word, ok: true, score };
    }

    // A duplicate is a no-op: it never counts as a wrong try.
    if (result.reason !== 'DUPLICATE') {
      player.wrongTries += 1;
      player.totalTries += 1;
      this.emitState();
      this.emitOwn(playerId);
    }
    return { word, ok: false, reason: result.reason };
  }

  // --------------------------------------------------------------- scoring

  private scoreAndReview(): void {
    const table = this.letterValues ?? { entries: [], values: {}, counts: {} };

    const inputs: RoundPlayerInput[] = [...this.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      validWords: [...player.validWords],
      wrongTries: player.wrongTries,
      totalTries: player.totalTries,
    }));

    const result = scoreRound({ players: inputs, letterValues: table.values });
    this.lastRoundResult = result;

    for (const entry of result.players) {
      const player = this.players.get(entry.id);
      if (player) player.score += entry.roundScore;
    }

    this.reviewSteps = buildReviewSteps(result);
    this.reviewIndex = 0;
    this.setPhase('REVIEW', REVIEW_SECONDS, () => this.stepReview());
    this.emitState();
    this.emitOwn();
  }

  private stepReview(): void {
    this.reviewIndex += 1;

    if (this.reviewIndex >= this.reviewSteps.length) {
      if (this.round >= ROUNDS) {
        this.clearTimer();
        this.phase = 'GAME_OVER';
        this.phaseEndsAt = null;
        this.emitState();
        this.emitOwn();
        return;
      }
      this.phase = 'RESULTS';
      this.phaseEndsAt = null;
      this.clearTimer();
      this.emitState();
      this.emitOwn();
      return;
    }

    this.setPhase('REVIEW', REVIEW_SECONDS, () => this.stepReview());
    this.emitState();
  }

  // ----------------------------------------------------------- presentation

  private setPhase(phase: Phase, seconds: number, onDone: () => void): void {
    this.clearTimer();
    this.phase = phase;
    this.phaseEndsAt = Date.now() + seconds * 1000;
    this.timer = setTimeout(() => {
      if (this.destroyed) return;
      this.timer = null;
      onDone();
    }, seconds * 1000);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
  }

  ownState(playerId: PlayerId): OwnState | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    const wordScores: Record<string, number> = {};
    for (const word of player.validWords) {
      wordScores[word] = [...word].reduce(
        (sum, letter) => sum + (this.letterValues?.values[letter] ?? 0),
        0,
      );
    }
    return {
      id: player.id,
      name: player.name,
      isHost: player.isHost,
      pick: [...player.pick],
      pickLimit: this.pickLimit,
      pickedLocked: player.pickLocked,
      words: [...player.validWords],
      wordScores,
      wrongTries: player.wrongTries,
      totalTries: player.totalTries,
      score: player.score,
    };
  }

  publicState(): PublicRoomState {
    const standings = [...this.players.values()]
      .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
      .map((player) => ({
        id: player.id,
        name: player.name,
        connected: player.connected,
        score: player.score,
        pickCount: player.pick.length,
        pickedLocked: player.pickLocked,
        validWordCount: player.validWords.length,
        wrongTries: player.wrongTries,
        totalTries: player.totalTries,
        isHost: player.isHost,
      }));

    const finalStandings =
      this.phase === 'GAME_OVER'
        ? [...standings].sort(
            (a, b) =>
              b.score - a.score ||
              b.validWordCount - a.validWordCount ||
              a.name.localeCompare(b.name),
          )
        : null;

    return {
      roomCode: this.code,
      phase: this.phase,
      round: this.round,
      roundCount: ROUNDS,
      phaseEndsAt: this.phaseEndsAt,
      players: standings,
      hostId: this.host?.id ?? null,
      letterValues: this.letterValues,
      usableLetterCount: this.letterValues?.entries.length ?? 0,
      minWordLength: MIN_WORD_LENGTH,
      pickLimit: this.pickLimit,
      timers: { pick: PICK_SECONDS, word: WORD_SECONDS },
      lastRoundResult: this.lastRoundResult,
      finalStandings,
      notice: this.notice,
      reviewSteps: this.reviewSteps,
      reviewIndex: this.reviewIndex,
    };
  }

  emitState(): void {
    if (this.destroyed) return;
    this.io.to(this.code).emit('state', this.publicState());
  }

  emitOwn(targetPlayerId?: PlayerId): void {
    if (this.destroyed) return;
    for (const player of this.players.values()) {
      if (targetPlayerId && player.id !== targetPlayerId) continue;
      if (!player.socketId) continue;
      const own = this.ownState(player.id);
      if (own) this.io.to(player.socketId).emit('own', own);
    }
  }
}

function buildReviewSteps(result: RoundResult): ReviewStep[] {
  const steps: ReviewStep[] = [];

  for (const unique of result.uniqueWords) {
    steps.push({
      kind: 'unique_word',
      word: unique.word,
      playerId: unique.playerId,
      playerName: unique.playerName,
      points: unique.points,
    });
  }

  if (result.mostUsedWords.length > 0) {
    steps.push({ kind: 'most_used_word', words: result.mostUsedWords });
  }

  for (const award of result.statAwards) {
    steps.push({ kind: 'stat', award });
  }

  steps.push({ kind: 'leaderboard' });
  return steps;
}
