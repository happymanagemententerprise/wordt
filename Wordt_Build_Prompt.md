# Wordt: Build / Update Prompt (v2, current ruleset)

You are working on **Wordt**, a multiplayer party word game (repo: happymanagemententerprise/wordt). Stack: TypeScript, Node, Socket.IO server; Vite + React clients: phone (`/play`) and shared TV (`/tv`). If the codebase already exists, update it to match this spec rather than rewriting from scratch. `README.md` in the repo is the source of truth for rules; if this prompt and the README disagree, ask.

## Build order
1. Scoring engine (pure functions) with unit tests covering every rule below.
2. Server (rooms, game state machine, validation, timers).
3. Phone client.
4. TV client.
5. Deployment config and README update.

## Game flow
Lobby -> Picking -> Word-making -> Results (reveal) -> next round or game over.
The host sets the round timer length in the lobby (no fixed default). The host role must be transferable to another player (see UI fixes).

## Picking
- 2 players: each picks 15 letters. 3+ players: each picks 10.
- No repeated letters within a player's own selection.
- At 8 players: 4 teams of 2. A team is one scoring unit everywhere. Each teammate picks 5 distinct letters (10 per team). Teammates see each other's picks live; the no-repeat rule applies across the whole team. Stats on TV show both the team name and the specific teammate responsible.

## Letter pool
- Fixed size of **15 letters** per round (make it a config constant; may change after playtesting).
- Sources: (1) player-overlap letters: any letter picked by 2+ players/teams; (2) computer-added letters: add exactly enough to reach 15, drawn fairly at random from remaining unused letters. The top-up must NOT favor J, X, Q, Z.
- Letters picked by only one player are unusable and excluded.

## Letter values (two parallel systems)
- **Player-overlap letters**: rank by pick count (most-picked first); break ties with fixed English frequency order `E T A O I N S H R D L C U M W F G Y P B V K J X Q Z`; split evenly into 5 tiers: 1 = most picked/common, 5 = least picked/rarest.
- **Computer-added letters**: standard Scrabble point values.
- **Vowels (A E I O U)** are tracked as their own pool: most-picked vowel = 1 point, least-picked vowel = 2 points.
- A word's score = sum of its letters' values, each by the system the letter belongs to.
- Example: E=1, T=2, R=3 -> TREE = 2+3+1+1 = 7.

## Rare letter box
- Each round shows one extra rare letter, separate from the 15-letter pool, usable by everyone, in unlimited words.
- The rare letter is always drawn from the set {Q, Z, X, J} and is always worth a flat 10 points, regardless of normal tier/Scrabble values. This is a deliberate trap: its high value should tempt multiple players into similar short words, triggering the same-word zero-out rule below.
- Source of the letter: computer-random pick from {Q, Z, X, J} by default. Keep the selection pool and point value as config constants.
- Reveal: highlight the player/team whose highest-scoring word used it.
- Tie rule: if multiple players submitted the exact same word and it is the top rare-letter word, zero it out (same-word-penalty style, nobody credited). Different words tied follow the standard tie rule.

## Making words
- Minimum length 3.
- Dictionary: the GitHub word list already integrated (name to be confirmed; do not swap it).
- Letter reuse allowed: a word may use a pool letter more times than its pool count (e.g. SEE with one E in the pool); each use scores separately.
- Invalid submissions give an immediate private notification to that player only, with a reason (not a word, too short, unusable letter). Others never see failed attempts.
- Unlimited retries until the timer ends. Resubmitting your own already-valid word is rejected and does NOT count as a wrong try; every other invalid attempt DOES count.

## Scoring and bonuses
- Same-word penalty: if ALL players/teams submit the same word, its points are deducted from everyone.
- Unique word (only one player/team has it): +2 per word.
- Most unique words: +2. Most created (valid) words: +2. Longest word: +2. Most point words (single highest-scoring word): +2.
- Best accuracy: +1, lowest wrong tries / total tries. Eligible only if valid word count >= half the average valid words per player (average = total valid words / players). Tie-break: most valid words.
- Most used word (submitted independently by the most players): TV highlight only, no points.
- Ties (longest word, most point words, most created words, most unique words, final game-over score): ALL tied players/teams get full points; TV shows the underlying numbers side by side. This is the fallback for any unlisted tie (accuracy keeps its own tie-break).

## End-of-round reveal (TV, after timer)
1. Rare letter result
2. Unique words
3. Most used word highlight
4. Each stat winner with points (ties shared and shown per rule)
5. "Words you missed": top 10 valid words by point value formable from the final pool that nobody submitted
6. Top 5 unclaimed high-value words spotlight (note: overlaps heavily with #5; implement as the first five of the same ranked list, styled as a spotlight, unless told otherwise)
7. Updated leaderboard

## UI fixes from live playtest (must include)
- **Host transfer**: host can hand the host role to another connected player; also auto-offer/transfer if the host disconnects.
- **Letter picking grid**: lay out as a compact 5x5 grid, not stretched across the full screen.
- **Lock-in button**: changes color once all required letters are selected/locked in.
- **On-screen keyboard**: higher contrast, larger, clearly visible keys.
- **Animation**: add polish throughout (letter pick/lock, pool reveal, score tallies, reveal sequence steps, leaderboard movement, transitions between phases). Respect `prefers-reduced-motion`.

## Visual design / color palette

Dark, high-energy theme. Use exactly these values:

- **Background**: `#181818` (dark gray)
- **Primary text**: `#F7F7F7` (off-white)
- **Accent 1**: `#FF5722` (vibrant orange): buttons, headers, key UI elements
- **Accent 2**: `#673AB7` (deep purple): fills, borders, panels, tile backs
- **Tap / selected / locked-in / hover state**: `#FFEB3B` (bright yellow). The phone UI is touch-first, so use this for tapped, selected and locked-in letter states, with hover only as a desktop/TV extra
- **Letter tiles**: warm cream `#F5EFE3` with dark text, so letters read like physical tiles on the dark background

Do not use the deep purple for small body text on the dark background (contrast too low); reserve it for fills, borders and larger elements. Apply the palette consistently across the phone client (`/play`) and the TV client (`/tv`).

## Config constants (single file)
`POOL_SIZE=15`, `PICKS_2P=15`, `PICKS_3P_PLUS=10`, `TEAM_MODE_PLAYERS=8`, `MIN_WORD_LENGTH=3`, bonus point values, frequency order, `RARE_LETTER_SOURCE='computer'`, `RARE_LETTER_SET=['Q','Z','X','J']`, `RARE_LETTER_VALUE=10`.

## Deployment
Deploy to Render per `Wordt_Deployment_Prompt.md`: server reads `process.env.PORT`, Socket.IO CORS allows the deployed origin, one Web Service serving the built client for `/play` and `/tv`.

## Testing
Unit tests for: pool building (fixed 15), tier assignment and tie-breaks, vowel pool values, letter reuse scoring, same-word penalty, every bonus and tie case, accuracy eligibility, rare letter zero-out, team picks. Then a manual end-to-end test with phones on different networks.
