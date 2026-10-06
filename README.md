# Wordt

A multiplayer party word game. Players pick letters together, the letters everyone
picked become the shared pool, and then everyone races to make the best words.

One machine runs the **game server**. Phones are the **player clients**. A big screen
is the **TV client**, which only ever displays what the server says.

---

## Quick start

```bash
npm install
npm run dev
```

That starts all three processes:

| process    | url                      |
| ---------- | ------------------------ |
| game server | http://localhost:3000    |
| phone client | http://localhost:5173  |
| TV client  | http://localhost:5174    |

Open http://localhost:5173 on two phones (or two browser windows), create a room on
one, join with the five character code on the other, then open
http://localhost:5174/?room=CODE on the big screen.

Other commands:

```bash
npm run build          # typecheck every workspace, then build both clients
npm test               # scoring engine unit tests
npm run typecheck      # tsc --noEmit in every workspace
npm run dev:server     # just the game server (tsx watch)
npm run dev:play       # just the phone client
npm run dev:tv         # just the TV client
```

---

## How to play

**1. Pick letters.** Every player chooses up to a share of the alphabet. A letter
only becomes *usable* when at least two players picked it. Two players get 15
letters each, three or more get 10.

**2. Read the value table.** Usable letters are ranked by how many players picked
them, ties broken by a fixed English frequency order. The letter at 0-based rank
`i` of `n` usable letters is worth `floor(i * 5 / n) + 1`, so the most picked and
most common letters are worth 1 and the rarest reach 5.

**3. Make words.** During the word phase every player types words built from
usable letters. Letters may be reused inside a word. A word scores the sum of its
letter values.

A submission is rejected in this order, and the first failure wins:

1. `TOO_SHORT` — shorter than 3 letters
2. `UNUSABLE_LETTER` — contains a letter nobody picked twice
3. `DUPLICATE` — this player already submitted it
4. `NOT_IN_DICTIONARY` — not in `shared/words.txt`

A duplicate is a no-op: it never counts as a wrong try. Every other rejection
increments both *wrong tries* and *total tries*, which is what accuracy is
measured against.

**4. Review.** The round is scored on the server and the results are revealed one
step at a time on the TV: unique words, then the stat bonuses, then any draft
penalties, then the standings. While games run, the TV also shows a live feed of
every accepted word and a progress bar for each player's letter pick.

### Scoring a round

```
round score = base score + shared-word penalty + draft penalty + bonuses
```

- **base score** — the sum of your accepted words.
- **shared-word penalty** — if *every* player submitted the same word, that word's
  points are deducted from each of them, so it nets to zero for everyone.
- **draft penalty** — each letter you picked but never used in any submitted word
  costs 1 point. It nudges you to commit to letters the team can actually use.
- **bonuses**

  | bonus                    | points |
  | ------------------------ | ------ |
  | each unique word         | +2     |
  | most unique words        | +2     |
  | most created words       | +2     |
  | longest word             | +2     |
  | highest-scoring word     | +2     |
  | best accuracy            | +1     |

  Best accuracy only considers players who made at least half of the per-player
  average of valid words. On a tie every tied player gets the full points, because
  `SHARE_POINTS_ON_STAT_TIES` is `true`.

The word the most players used is highlighted on the TV but scores nothing.

### Playing with teams

The host can turn **team mode** on in the lobby. Players are auto-split across two
balanced teams (A and B), and anyone can tap a team card in the lobby to switch.
Teams are capped at two members; the auto-split balances them when a new player
joins or the mode is toggled.

Teams play the same round but *as one competitor each*: two team members get five
letters each (ten per team, to match the three-or-more-player share), cannot pick
a letter a teammate already picked, and their scored words are merged and reported
as a single team score. Standings then show **Team A** and **Team B** instead of
individual rows, and the round review explains whose word earned each team its
points.

### Ending the game

The host's phone has an *End game* button at any time during play; it finishes the
current round, jumps straight to `GAME_OVER`, and shows final standings.

Rounds repeat for `ROUNDS` (3). Final standings are ordered by score, then by
total valid words; players still level share the win.

---

## Project layout

```
shared/     pure scoring + word rules, and the word list. No I/O, no sockets.
server/     authoritative Socket.IO game server. Owns all mutable game state.
client-play/  the phone client (Vite + React, port 5173)
client-tv/    the TV client   (Vite + React, port 5174)
```

`shared/` is the only place rules are written down. It is consumed two different
ways: the server imports `@wordt/shared/dictionary`, which reads `words.txt` from
disk, and the clients import `@wordt/shared`, which is browser-safe and has no
filesystem access. `client-play/vite.config.ts` and `client-tv/vite.config.ts`
exclude it from dependency pre-bundling because it ships TypeScript source.

The clients never compute a score. They send intents, the server answers with
acknowledgements, and the server pushes `state`/`own` snapshots to everyone.

---

## Server protocol

Every client → server event is acknowledged with `{ ok, error?, ... }`.
The server sends `state` **before** the acknowledgement, so a client that attaches
its listener after awaiting an ack will miss that update — the clients in this
repo cache from connect time for exactly that reason.

| event           | payload                  | who   | purpose                         |
| --------------- | ------------------------ | ----- | ------------------------------- |
| `room:create`   | `{ name }`               | phone | create a room, becomes host     |
| `room:join`     | `{ roomCode, name?, playerId? }` | phone | join or rejoin a room      |
| `tv:watch`      | `{ roomCode }`           | TV    | watch a room, no player seat    |
| `host:start`    | —                        | host  | lobby → picking, or new game    |
| `host:next`     | —                        | host  | results → next round            |
| `host:lobby`    | —                        | host  | back to the lobby               |
| `host:end`      | —                        | host  | end the game now → `GAME_OVER`  |
| `host:teams`    | `{ enabled }`            | host  | turn team mode on/off (lobby)   |
| `team:set`      | `{ teamId }`             | phone | move your seat to a team (lobby)|
| `review:next`   | —                        | host  | advance the review one step     |
| `pick:set`      | `{ letters }`            | phone | set this player's pick          |
| `pick:lock`     | —                        | phone | lock this player's pick         |
| `word:submit`   | `{ word }`               | phone | submit a word                   |

server → client:

- `state` — `PublicRoomState`, the room as everyone sees it
- `own` — `OwnState`, only to the player the seat belongs to

Phases: `LOBBY → PICKING → VALUE_TABLE → WORDS → NOTICE → REVIEW → RESULTS`,
repeating for each round, ending in `GAME_OVER`.

---

## Configuration

Game rules are constants in `shared/src/config.ts`. Nothing else hard-codes one.

Phase timers come from that file but the server can override them from the
environment, which is what the tests use:

| variable                    | default | meaning                              |
| --------------------------- | ------- | ------------------------------------ |
| `WORDT_PICK_SECONDS`        | 30      | letter picking                       |
| `WORDT_VALUE_REVEAL_SECONDS`| 8       | how long the value table is shown    |
| `WORDT_WORD_SECONDS`        | 120     | word entry                           |
| `WORDT_REVIEW_STEP_SECONDS` | 6       | each step of the round review        |
| `VITE_SERVER_URL`           | `http://localhost:3000` | where clients connect |
| `VITE_PLAY_URL`             | `http://localhost:5173` | phone URL the TV's QR encodes |

The timers are read once at server start.

---

## Testing

```bash
npm test                             # 48 scoring-engine unit tests
npm run typecheck                    # every workspace
npm run smoke --workspace @wordt/server
npm run e2e  --workspace @wordt/client-play
```

The **unit tests** cover letter values, round scoring, bonuses, penalties,
standings and the winner determination.

The **smoke test** plays a full round through the real socket protocol: two
players, one word phase, the review, and a second round with the score carried
over. It needs the server running.

The **e2e test** launches real Chrome through Playwright and drives two phone
windows *and* the TV through a complete round, asserting what each screen shows.
It needs the server and both dev servers running. It is deliberately generous
about phase timers, so it works with whatever `WORDT_*_SECONDS` you are running.

On Windows, `npm` is blocked by execution policy — use `npm.cmd`.

---

## Assumptions

Things the spec left open, and what this build does:

1. **Ports** — server `3000`, phone client `5173`, TV client `5174`.
2. **Phase timer defaults** — pick 30s, value table 8s, words 120s, review step
   6s. Not specified, so they were chosen to feel right on a TV and are all
   overridable per environment.
3. **Word phase ends on its timer only.** Players are not advanced early when
   everyone has submitted, so a straggler never gets cut off mid-word.
4. **`SHARE_POINTS_ON_STAT_TIES = true`** — a tied player each receives the full
   bonus. The alternative (`false`) awards nobody on a tie; the lone-winner case
   is unaffected either way.
5. **Host controls live on the host's phone**, not the TV: *Start game*,
   *Next round*, *New game*, *Back to lobby*, and skipping ahead in the review.
   The TV is display-only by design — it holds no player seat and cannot affect
   the game. Review steps still auto-advance on their own timer.
6. **Pick limits** — 15 letters for two players, 10 for three or more. In team
   mode a member of a two-person team gets 5 (10 per team) and solo members of a
   single team get the normal share.
7. **Teams** — mode is opt-in (host toggles it in the lobby), capped at two
   players, and always exactly two teams. A team scores as one merged competitor;
   its members share the same round score and a member's letter pick cannot
   contain a letter a teammate already picked. The auto-split keeps the teams as
   balanced as possible — odd player counts leave one team with a single member,
   who gets the full solo share of letters.
8. **Draft penalty** — 1 point per drafted letter that never appears in any
   submitted word, shown as its own review step only when at least one player
   earns it.
9. **Room codes** are 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
   (no `I`, `O`, `0`, `1`, so they are readable aloud).
10. **Empty rooms are deleted 5 minutes** after the last phone and the last TV
    disconnect, so a refresh can rejoin but abandoned rooms do not accumulate.
11. **Rejoining** — a phone keeps its seat in `localStorage` under `wordt.seat`
    and re-sends `room:join` with that id on reconnect. If the room is gone the
    seat is dropped and the player is returned to the join screen.
12. **TV room entry** — `?room=CODE` in the URL, or typed into the on-screen
    form. The lobby QR encodes `<VITE_PLAY_URL>/?room=CODE` so a phone camera
    opens the join form with the code already filled in.
13. **Letter values are recomputed per round** from that round's picks; they are
    not carried between rounds.
14. **The legacy ASP.NET Core prototype** (`GameHub.cs`, `Program.cs`,
    `WordtGame.csproj`, `wwwroot/`) is still in the repository, untouched. It is
    not part of the Node build and nothing references it.
15. **`npm audit` reports 3 advisories** (1 moderate, 2 critical), all inside the
    `vitest` toolchain, which is development-only and not shipped to players.
    The fix requires a major `vitest` upgrade, so it was left alone rather than
    churn a passing test suite. Worth revisiting before this handles untrusted
    input.
16. **TypeScript stays on 5.x.** The registry's latest is 7.x; 5.7 is what the
    whole repo is pinned to.
