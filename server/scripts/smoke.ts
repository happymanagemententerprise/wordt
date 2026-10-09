/**
 * End-to-end smoke test against a running server. Two players play one full
 * round. Any WORDT_*_SECONDS values work — the waits below are deliberately
 * generous, so a long word phase just makes the run slower.
 *
 *   npm run start --workspace @wordt/server
 *   npm run smoke --workspace @wordt/server
 *
 * State is cached from the moment a socket connects, because the server sends
 * `state` before it acknowledges an action — a listener attached after the
 * ack would miss that update.
 */
import { io, type Socket } from 'socket.io-client';

const URL = process.env.WORDT_URL ?? 'http://localhost:3000';

interface Ack {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  outcome?: { word: string; ok: boolean; reason?: string; score?: number };
}

const latestState = new Map<Socket, any>();
const latestOwn = new Map<Socket, any>();

function connect(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'] });
    socket.on('state', (state) => latestState.set(socket, state));
    socket.on('own', (own) => latestOwn.set(socket, own));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
    setTimeout(() => reject(new Error('connect timeout')), 5000);
  });
}

function emit(socket: Socket, event: string, payload: Record<string, unknown> = {}): Promise<Ack> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: `timeout on ${event}` }), 5000);
    socket.emit(event, payload, (ack: Ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function awaitState(socket: Socket, predicate: (state: any) => boolean, ms: number, label: string): Promise<any> {
  const cached = latestState.get(socket);
  if (cached && predicate(cached)) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('state', handler);
      reject(new Error(`timed out waiting for ${label}`));
    }, ms);
    const handler = (state: any) => {
      if (!predicate(state)) return;
      clearTimeout(timer);
      socket.off('state', handler);
      resolve(state);
    };
    socket.on('state', handler);
  });
}

function awaitOwn(socket: Socket, predicate: (own: any) => boolean, ms: number, label: string): Promise<any> {
  const cached = latestOwn.get(socket);
  if (cached && predicate(cached)) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('own', handler);
      reject(new Error(`timed out waiting for ${label}`));
    }, ms);
    const handler = (own: any) => {
      if (!predicate(own)) return;
      clearTimeout(timer);
      socket.off('own', handler);
      resolve(own);
    };
    socket.on('own', handler);
  });
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const ann = await connect();
  const bob = await connect();
  console.log('connected both players');

  const created = await emit(ann, 'room:create', { name: 'Ann' });
  assert(created.ok, `create failed: ${created.error}`);
  const code = created.roomCode!;
  const annId = created.playerId!;

  const alone = await emit(ann, 'host:start');
  assert(!alone.ok, 'a single player must not be able to start');

  const joined = await emit(bob, 'room:join', { roomCode: code, name: 'Bob' });
  assert(joined.ok, `join failed: ${joined.error}`);
  const bobId = joined.playerId!;
  console.log(`room ${code} with Ann + Bob`);

  const lobby = await awaitState(ann, (s) => s.players.length === 2, 5000, 'two players');
  assert(lobby.phase === 'LOBBY', `expected LOBBY, got ${lobby.phase}`);
  assert(lobby.hostId === annId, 'creator should be host');

  const nonHostStart = await emit(bob, 'host:start');
  assert(!nonHostStart.ok, 'non-host must not be able to start');

  const noTimerStart = await emit(ann, 'host:start');
  assert(!noTimerStart.ok, 'start must fail until the host picks a round length');

  const badTimer = await emit(ann, 'host:timer', { seconds: 5 });
  assert(!badTimer.ok, 'round length below the minimum must be rejected');
  assert((await emit(ann, 'host:timer', { seconds: 30 })).ok, 'host should set the round length');
  const withTimer = await awaitState(ann, (s) => s.roundSeconds === 30, 5000, 'roundSeconds 30');
  assert(withTimer.roundSeconds === 30, 'lobby should expose the chosen round length');

  assert((await emit(ann, 'host:start')).ok, 'host should start the game');

  const picking = await awaitState(ann, (s) => s.phase === 'PICKING', 5000, 'PICKING');
  console.log(`round ${picking.round} -> PICKING, pickLimit=${picking.pickLimit}`);

  const letters = ['E', 'T', 'A', 'O', 'I', 'N', 'S', 'H', 'R', 'D', 'L', 'C', 'U', 'M', 'W'];
  assert((await emit(ann, 'pick:set', { letters })).ok, 'ann pick:set failed');
  assert((await emit(bob, 'pick:set', { letters })).ok, 'bob pick:set failed');

  const own = await awaitOwn(ann, (o) => o.pick.length === 15, 5000, 'own pick of 15');
  assert(own.pickLimit === 15, `expected pickLimit 15 for two players, got ${own.pickLimit}`);
  assert(own.words.length === 0, 'no words yet');

  assert((await emit(ann, 'pick:lock')).ok, 'ann lock failed');
  assert((await emit(bob, 'pick:lock')).ok, 'bob lock failed');
  const valueTable = await awaitState(ann, (s) => s.phase === 'VALUE_TABLE', 8000, 'VALUE_TABLE');
  const table = valueTable.letterValues.entries.map((e: any) => `${e.letter}=${e.value}`).join(' ');
  console.log(`value table: ${table}`);
  assert(valueTable.usableLetterCount === 15, `expected 15 usable letters, got ${valueTable.usableLetterCount}`);
  assert(valueTable.rareLetter, 'a rare letter should be drawn while candidates remain');
  assert(
    valueTable.letterValues.entries.every((e: any) => e.letter !== valueTable.rareLetter),
    'the rare letter must not be in the round pool',
  );
  const vowelCheck = (l: string) => l === 'A' || l === 'E' || l === 'I' || l === 'O' || l === 'U';
  assert(!vowelCheck(valueTable.rareLetter), 'the rare letter must be a consonant');
  assert(
    valueTable.rareUsedBy !== undefined && Array.isArray(valueTable.rareUsedBy) && valueTable.rareUsedBy.length === 0,
    'no player should have spent the rare letter yet',
  );
  console.log(`rare letter drawn: ${valueTable.rareLetter}`);

  const words = await awaitState(ann, (s) => s.phase === 'WORDS', 8000, 'WORDS');
  console.log(`WORDS phase, minimum length ${words.minWordLength}`);
  assert(words.minWordLength === 3, `expected minimum word length 3, got ${words.minWordLength}`);

  assert(!(await emit(ann, 'word:submit', { word: 'ZZZ' })).ok, 'junk word should be rejected');
  assert(!(await emit(ann, 'word:submit', { word: 'S' })).ok, 'single-letter word should be rejected');
  const annWord = await emit(ann, 'word:submit', { word: 'STORE' });
  assert(annWord.ok, `ann word failed: ${annWord.error}`);
  const dup = await emit(ann, 'word:submit', { word: 'STORE' });
  assert(!dup.ok, 'duplicate should be rejected');
  const bobWord = await emit(bob, 'word:submit', { word: 'STONE' });
  assert(bobWord.ok, `bob word failed: ${bobWord.error}`);
  console.log(`accepted words: STORE=${annWord.outcome?.score} STONE=${bobWord.outcome?.score}`);

  const ownWords = await awaitOwn(ann, (o) => o.words.length === 1, 5000, 'own word recorded');
  assert(ownWords.wordScores.STORE === annWord.outcome?.score, 'own word score mismatch');
  assert(ownWords.wrongTries === 2, `expected 2 wrong tries, got ${ownWords.wrongTries}`);
  assert(ownWords.totalTries === 3, `expected 3 total tries, got ${ownWords.totalTries}`);

  const review = await awaitState(ann, (s) => s.phase === 'REVIEW', 60000, 'REVIEW');
  assert(review.reviewSteps.length >= 6, 'expected review steps');
  if (review.reviewSteps[0].kind === 'rare_letter') {
    assert(review.rareLetter, 'the review should carry the rare letter');
  }
  console.log(`review steps: ${review.reviewSteps.map((s: any) => s.kind).join(' -> ')}`);
  const stepKinds = review.reviewSteps.map((s: any) => s.kind);
  assert(stepKinds[0] === 'rare_letter', 'the rare letter reveal must come first');
  assert(stepKinds.includes('missed_words'), 'expected a missed-words reveal');
  assert(
    stepKinds.indexOf('spotlight') !== -1 &&
      stepKinds.indexOf('leaderboard') !== -1 &&
      stepKinds.indexOf('spotlight') < stepKinds.indexOf('leaderboard'),
    'the spotlight reveal must precede the leaderboard',
  );

  let state = review;
  let guard = 0;
  while (state.phase === 'REVIEW' && guard < 30) {
    const before = state.reviewIndex;
    assert((await emit(ann, 'review:next')).ok, 'review:next failed');
    state = await awaitState(ann, (s) => s.reviewIndex !== before || s.phase !== 'REVIEW', 8000, 'review step');
    guard += 1;
  }
  assert(state.phase === 'RESULTS', `expected RESULTS, got ${state.phase}`);

  const annScore = state.players.find((p: any) => p.id === annId).score;
  const bobScore = state.players.find((p: any) => p.id === bobId).score;
  console.log(`standings after round 1: Ann=${annScore} Bob=${bobScore}`);
  assert(annScore > 0 || bobScore > 0, 'someone should have scored');
  assert(state.lastRoundResult, 'lastRoundResult missing');

  assert(!(await emit(bob, 'host:next')).ok, 'non-host cannot start next round');
  assert((await emit(ann, 'host:next')).ok, 'host should start next round');
  const round2 = await awaitState(ann, (s) => s.round === 2 && s.phase === 'PICKING', 8000, 'round 2');
  const carried = round2.players.find((p: any) => p.id === annId).score;
  assert(carried === annScore, `scores should carry over: ${carried} !== ${annScore}`);
  console.log(`round 2 started, carried score ${carried}`);

  console.log('\nSMOKE TEST PASSED');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`\nSMOKE TEST FAILED: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
