# Wordt Created by Happy Management

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

These rules are shown on-screen too: the phone client has a *How to play* link
above its join form, and the TV client has one on its room-code entry page. Both
now open an illustrated **carousel** — swipe or use the arrows on the phone,
arrow keys or the on-screen arrows on the TV. The slides live in each client's
`public/how-to-play/`.

**1. Pick letters.** Every player chooses up to a share of the alphabet. Two
players get 15 letters each, three or more get 10. Letters that **two or more
players picked** become the *overlap pool*; the computer tops the pool up to
a fixed 15 letters with random letters nobody overlapped on.

**2. Read the value table.** Overlap letters are ranked by how many players
picked them, ties broken by a fixed English frequency order — but consonants
and vowels rank inside their own groups, so vowels never get expensive.
Consonants spread over 5 tiers (1–5), vowels over 2 (1–2). Letters the
computer added score their fixed Scrabble value instead.

**3. Make words.** During the word phase every player types words built from
pool letters. Letters may be reused inside a word. A word scores the sum of its
letter values.

A submission is rejected in this order, and the first failure wins:

1. `TOO_SHORT` — shorter than 3 letters
2. `UNUSABLE_LETTER` — contains a letter outside the pool
3. `DUPLICATE` — this player already submitted it
4. `NOT_IN_DICTIONARY` — not in `shared/words.txt`

A duplicate is a no-op: it never counts as a wrong try. Every other rejection
increments both *wrong tries* and *total tries*, which is what accuracy is
measured against.

**4. Review.** The round is scored on the server and the results are revealed one
step at a time on the TV: the rare letter (when one was drawn), unique words,
the most-used word, the stat bonuses, any draft penalties, then a **spotlight**
on the five highest-scoring words the pool could have made that nobody
submitted — each with its part of speech and a short dictionary definition — and
finally the standings. While games run, the TV also shows a live feed of every
accepted word and a progress bar for each player's letter pick.

The TV plays like a game show: pool letters sit on bright contrasting tiles, a
semi-transparent clock counts the phase down in the corner, the standings crown
the current leader and mark rank moves (▲/▼), team play gets a split battle bar
under the top bar, the live feed flags hot streaks and big words, and the final
results land on a podium with medals and confetti.

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
  | rare letter find         | +10    |

  Best accuracy only considers players who made at least half of the per-player
  average of valid words. On a tie every tied player gets the full points, because
  `SHARE_POINTS_ON_STAT_TIES` is `true`.

  The rare letter is drawn once per game (a weighted consonant, never a vowel)
  and stays the same for every round. It's worth +10 to a player (or team) if
  their best word containing it is not zeroed. If two or more players submit the
  *identical* rare word this round, that word nets to zero for them and nobody
  gets the +10. Different rare words each keep the bonus. Each player may use
  the rare letter only once for the whole game. The rare letter never counts
  toward a word's normal tile value.

The word the most players used is highlighted on the TV but scores nothing.

### Setting a round length

Before the game starts, the host picks how long the word phase lasts from the
lobby (30s, 1m, 1m 30s, or 2m, or anything from 10 to 600 seconds). The game
won't start until a length is chosen. Rounds within a game all use that length.
`WORDT_WORD_SECONDS` remains the fallback for anything that isn't a live game.

### Choosing how many rounds

Right below the round length the host picks how many rounds to play: **3** (the
default), **5**, or **Unlimited**. Unlimited keeps the round loop going until the
host ends the game with *End game*. The choice is made in the lobby and applies
for the whole session; `Next round` is hidden once the chosen number is reached.

### Playing with teams

The host can turn **team mode** on in the lobby. Teams are always two members,
and how many teams exist follows the player count: 3–4 players split into two
teams (A, B), 5–6 into three (A–C), and 7–8 into the full four (A–D). A lone
pair still gets two teams. The game accepts up to 8 players. Players are
auto-split onto the emptiest team, and anyone can tap a team card in the lobby
to switch.

Teams play the same round but *as one competitor each*: two team members get five
letters each (ten per team, to match the three-or-more-player share), cannot pick
a letter a teammate already picked, and their scored words are merged and reported
as a single team score. Standings then show **Team A**, **Team B**, and so on
instead of individual rows, and the round review explains whose word earned each
team its points.

### Ending the game

The host's phone has an *End game* button at any time during play; it finishes the
current round, jumps straight to `GAME_OVER`, and shows final standings.

Anyone can then tap *Leave room* to return to their home page. If the **host**
leaves, the whole session ends: every phone and the TV is sent back to its entry
screen and the room is deleted. If anyone else leaves, only their seat is freed
and the game carries on without them.

The host can hand the crown to any connected player at any time by tapping
*Host* on their row in the lobby. After a transfer the new host owns the Start/End
controls for the rest of the session.

The host can also **remove** a disruptive player by tapping *Remove* on their row.
That player is dropped from the room and returned to their home page; they can
rejoin with the room code. The host cannot remove themselves.

Rounds repeat for the host's chosen count (3 by default, 5, or unlimited). Final
standings are ordered by score, then by total valid words; players still level
share the win.

---

## Deploying

The whole game ships as **one service**. `npm run build` at the root typechecks
every workspace and produces `client-play/dist` and `client-tv/dist`. The server
is the only process you need to run, and it serves both built apps itself:

- `/play` — the phone client
- `/tv` — the TV client
- `/` — redirects to `/play`

Unknown routes under each prefix fall back to that app's `index.html`, so
refreshes and deep links land on the right screen.

```bash
npm run build                      # typecheck + build both clients
npm run start --workspace @wordt/server   # serves /play and /tv on :3000
```

Render hosters already inject `PORT`. The phone and TV load from the same
origin, so CORS stays open (`origin: true`) without exposing anything. The
client builds assume a `/play/` (phone) or `/tv/` (TV) base path, so the built
apps must be served from those prefixes — never from a file URL. Dev mode is
unaffected and keeps running at `/`.

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
| `host:timer`    | `{ seconds }`            | host  | set the round length (lobby)    |
| `host:rounds`   | `{ rounds }`             | host  | set rounds to play: `3`, `5`, or `null` for unlimited (lobby) |
| `host:teams`    | `{ enabled }`            | host  | turn team mode on/off (lobby)   |
| `team:set`      | `{ teamId }`             | phone | move your seat to a team (lobby)|
| `review:next`   | —                        | host  | advance the review one step     |
| `host:transfer` | `{ playerId }`           | host  | hand the host crown to another connected player |
| `host:kick`     | `{ playerId }`           | host  | remove a player from the room   |
| `pick:set`      | `{ letters }`            | phone | set this player's pick          |
| `pick:lock`     | —                        | phone | lock this player's pick         |
| `word:submit`   | `{ word }`               | phone | submit a word                   |
| `room:leave`    | —                        | phone | leave the room. The host leaving ends the whole session |

server → client:

- `state` — `PublicRoomState`, the room as everyone sees it
- `own` — `OwnState`, only to the player the seat belongs to
- `room:ended` — the session is over (the host left); every client returns home
- `room:removed` — the host removed this player; that phone returns home

Phases: `LOBBY → PICKING → VALUE_TABLE → WORDS → NOTICE → REVIEW → RESULTS`,
repeating for each round, ending in `GAME_OVER`.

---

## Configuration

Game rules are constants in `shared/src/config.ts`. Nothing else hard-codes one.

Phase timers come from that file but the server can override them from the
environment, which is what the tests use. The word phase is set by the **host in
the lobby** during a real game; `WORDT_WORD_SECONDS` only applies when no live
game has picked one:

| variable                    | default | meaning                              |
| --------------------------- | ------- | ------------------------------------ |
| `WORDT_PICK_SECONDS`        | 30      | letter picking                       |
| `WORDT_VALUE_REVEAL_SECONDS`| 8       | how long the value table is shown    |
| `WORDT_WORD_SECONDS`        | 120     | fallback word phase length           |
| `WORDT_REVIEW_STEP_SECONDS` | 6       | each step of the round review        |
| `WORDT_LOG_FILE`            | `logs/events.jsonl` | where the analytics log is appended (relative to the server's working directory) |
| `WORDT_LOG_STDOUT`          | `true`  | also mirror every event line to stdout; set `0`/`false`/`no`/`off` to silence |
| `WORDT_DEFINITIONS_API`     | `https://freedictionaryapi.com/api/v1/entries/en` | base URL for the spotlight's word lookups |
| `WORDT_DEFINITIONS_CACHE`   | `data/definitions-cache.json` | where looked-up definitions are cached; set `0`/`false`/`no`/`off` to keep it in memory only |
| `VITE_SERVER_URL`           | `http://localhost:3000` | where clients connect |
| `VITE_PLAY_URL`             | `http://localhost:5173` | phone URL the TV's QR encodes |

The timers are read once at server start.

---

## Analytics log

The server appends one JSON object per line (**JSONL**) to `logs/events.jsonl`
(override with `WORDT_LOG_FILE`). Nothing about the game rules changes: the log is
append-only, written from the server only, and a failed write is reported to the
console but never interrupts play. Each line is also mirrored to stdout unless
`WORDT_LOG_STDOUT` is turned off.

Every line carries `ts` (ISO timestamp), `gameId` (unique per game session),
`roomCode`, `round` (or `null` outside a round) and `type`, plus that event's
fields. Players are identified by their opaque socket `playerId`; names, IPs and
other personal data are never written.

| `type`              | what it records |
| ------------------- | --------------- |
| `game_start`        | `playerCount`, `teamMode`, `roundSeconds` |
| `picks_locked`      | `playerId`/`teamId`, `letters`, `msIntoPickPhase` |
| `pool_built`        | `pool`, `overlapLetters`, `computerAddedLetters`, `rareLetter`, `letterValues` |
| `word_submitted`    | `playerId`, `word`, `valid`, `reason?`, `countsAsWrongTry`, `points?`, `msIntoRound` |
| `rare_letter_used`  | `playerId`, `word`, `round` |
| `round_scored`      | per-player `baseScore`, `sharedWordPenalty`, `draftPenalty`, `bonuses`, `roundScore`, `totalScore`, plus the most-used words and the rare-letter winner |
| `game_over`         | final `standings` (playerId/score/validWordCount) and `winners` |

The log is append-only JSONL, so it is safe to `tail` while a game runs:

```bash
tail -f server/logs/events.jsonl
```

On Render's free tier the filesystem is ephemeral — the file is wiped on every
deploy or restart. Point `WORDT_LOG_FILE` at a mounted disk (or forward stdout,
which Render captures) if you need the log to survive.

---

## Analytics pipeline

`analytics/` is a small Python package that pulls those events back out of Render
and writes them into a Google Sheet. It is run every 15 minutes by
[`.github/workflows/analytics.yml`](.github/workflows/analytics.yml) (and can be
triggered by hand from the Actions tab).

It reads the service's logs through Render's [List logs API](https://api-docs.render.com/reference/list-logs),
keeps only the game's JSON event lines, and appends the new ones to an **Events**
tab. Events are de-duplicated by a content hash, so re-querying an overlapping
window never double-counts. The summary tabs are then rebuilt from the full stored
event set each run, which keeps them consistent and makes a re-run a no-op.

| Tab          | what it holds |
| ------------ | ------------- |
| `Events`     | one row per event: `event_id`, `timestamp`, `gameId`, `roomCode`, `round`, `type`, `playerId`, and the rest as JSON `details` |
| `Games`      | one row per game: room, start/end, player count, team mode, rounds, winners, final standings, total valid words |
| `Words`      | each submitted word: submissions, valid/invalid counts, total and average points |
| `Letters`    | per letter: times in the pool, times picked, times used in valid words, points earned |
| `Rejections` | invalid submissions by `reason`, with how many were wrong tries |
| `Meta`       | the resume cursor (`lastProcessedTimestamp`), last run time and event count |

A run resumes from the stored cursor with a small overlap (Render pagination can
re-serve boundary logs); de-duplication makes the overlap harmless. `--dry-run`
reads the real sheet and prints the tables it *would* write, without writing.

```bash
cd analytics
python -m pip install -e ".[dev]"
python -m wordt_analytics --dry-run --events-file ../server/logs/events.jsonl  # offline
python -m wordt_analytics --dry-run                                            # against Render
python -m pytest
```

Without `--events-file` it calls the Render API; without `--dry-run` it writes to
the sheet. Other flags: `--window-hours` (first-run lookback), `--start`/`--end`
(an explicit window), `--sheet-id`.

The workflow expects these repository **secrets**:

| Secret | what it is |
| ------ | ---------- |
| `RENDER_API_KEY` | a Render API key with read access |
| `RENDER_SERVICE_ID` | the `srv_…` id of the Wordt web service |
| `RENDER_OWNER_ID` | the Render workspace/owner id |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | the service account key JSON, as a single string |
| `GOOGLE_SHEET_ID` | optional; falls back to the project's default sheet |

Share the spreadsheet with the service account's `client_email` and give it
**Editor** access. The service account only ever sees this one sheet.

---

## Testing

```bash
npm test                             # scoring-engine + server unit tests
npm run typecheck                    # every workspace
npm run smoke --workspace @wordt/server
npm run e2e  --workspace @wordt/client-play
```

The **unit tests** cover letter values, the letter pool, missed-word finding,
dictionary definitions for the spotlight (sense picking, truncation, caching and
timeout handling), round scoring, bonuses, penalties, standings, teams and the
winner determination, plus the analytics logger (valid JSONL, and a failed write
never throws).

The **smoke test** plays a full round through the real socket protocol: two
players, one word phase, the review, and a second round with the score carried
over. It also reads back the analytics log this run produced and asserts the
events appear in order (`game_start` → `picks_locked` → `pool_built` →
`word_submitted` → `round_scored` → `game_over`) with the expected fields. It
needs the server running.

The **e2e test** launches real Chrome through Playwright and drives two phone
windows *and* the TV through a complete round, asserting what each screen shows.
It also ends the game from the final results and checks that leaving the session
returns every screen to its home page. It needs the server and both dev servers
running. It is deliberately generous about phase timers, so it works with
whatever `WORDT_*_SECONDS` you are running.

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
   *Next round*, *New game*, *Back to lobby*, picking the round length, and
   skipping ahead in the review. The TV is display-only by design — it holds no
   player seat and cannot affect the game. Review steps still auto-advance on
   their own timer.
6. **Pick limits** — 15 letters for two players, 10 for three or more. In team
   mode a member of a two-person team gets 5 (10 per team) and solo members of a
   single team get the normal share.
7. **Teams** — mode is opt-in (host toggles it in the lobby). Teams are always
   two members; the *number* of teams follows the room: 2 teams at 3–4 players,
   3 at 5–6, 4 at 7–8. A team scores as one merged competitor; its members share
   the same round score and a member's letter pick cannot contain a letter a
   teammate already picked. Players are auto-assigned to the emptiest team and
   can tap a card in the lobby to switch.
8. **Draft penalty** — 1 point per drafted letter that never appears in any
   submitted word, shown as its own review step only when at least one player
   earns it.
9. **The letter pool is fixed at 15** — the overlap letters (picked by two+)
   join random computer-added letters nobody overlapped on. Pool/value building
   uses an injected RNG, so tests are deterministic; the server passes the
   default (`Math.random`).
10. **Spotlight** — a single review step featuring the five highest-scoring words
    formable from the pool that no player submitted, right before the standings,
    so the best find is the last thing players remember. Computed on the server
    by scanning the dictionary once per round; skipped when nothing qualifies.
    The server then looks up a short definition for each of those five words and
    attaches it to the reveal, so the TV can show the word, its part of speech
    and a one-line meaning. Definitions come from the English **Wiktionary** via
    [FreeDictionaryAPI.com](https://freedictionaryapi.com) and are used under
    [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), credited
    on screen. Lookups are best-effort — capped at 2s per word, cached per
    process, and simply omitted (word and points only) if the dictionary is
    unreachable — so the review never waits on the network.
11. **Round length is a host choice** (10–600s, suggested 30/60/90/120) made in
   the lobby before the game starts; the game cannot start without one. Picks
   the first game's length, reused for every round until the room is recreated.
   The host also picks the **round count** there (3, 5, or unlimited;
   `DEFAULT_ROUND_COUNT` is 3).
12. **Room codes** are 5 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
    (no `I`, `O`, `0`, `1`, so they are readable aloud).
13. **Empty rooms are deleted 5 minutes** after the last phone and the last TV
    disconnect, so a refresh can rejoin but abandoned rooms do not accumulate.
14. **Rejoining** — a phone keeps its seat in `localStorage` under `wordt.seat`
    and re-sends `room:join` with that id on reconnect. If the room is gone the
    seat is dropped and the player is returned to the join screen.
15. **TV room entry** — `?room=CODE` in the URL, or typed into the on-screen
    form. The lobby QR encodes `<VITE_PLAY_URL>/?room=CODE` so a phone camera
    opens the join form with the code already filled in.
16. **Letter values are recomputed per round** from that round's picks; they are
    not carried between rounds.
17. **The legacy ASP.NET Core prototype** (`GameHub.cs`, `Program.cs`,
    `WordtGame.csproj`, `wwwroot/`) is still in the repository, untouched. It is
    not part of the Node build and nothing references it.
18. **`npm audit` reports 3 advisories** (1 moderate, 2 critical), all inside the
    `vitest` toolchain, which is development-only and not shipped to players.
    The fix requires a major `vitest` upgrade, so it was left alone rather than
    churn a passing test suite. Worth revisiting before this handles untrusted
    input.
19. **TypeScript stays on 5.x.** The registry's latest is 7.x; 5.7 is what the
    whole repo is pinned to.
20. **The rare letter** — once the picks close, the server draws one letter from
    every alphabet letter no player drafted that the pool does not hold either
    (`RARE_LETTER_SOURCE = 'computer'`), worth `RARE_LETTER_VALUE` (10 points)
    and revealed in the review as its own step. Only a single finder — one
    player, or one team whose merged words contain the letter — earns the 10;
    if two or more players find it, nobody is credited, mirroring the
     shared-word rule. Both clients mark the rare letter on the pool screens from
     the value table onward. When the players collectively drafted the whole
     alphabet there are no candidates and no rare letter is drawn that round.
21. **Unique words are reviewed together.** All unique words revealed in a round
    are grouped by the unit that found them and shown as a single review step,
    instead of one step per word — a long list no longer drags the review out.
22. **The phone home screen defaults to Join.** It shows two tabs, *Join a room*
    (default, room code first) and *Create a room*. For a link with `?room=CODE`
    the tabs are hidden and the code is pre-filled; editing `?room=` in the URL
    updates the form live.
23. **Kicking is host-only and lobby/round agnostic.** A removed player's socket
    is detached and their seat freed immediately (unlike a disconnect, they no
    longer appear), and they can rejoin later with the room code.
