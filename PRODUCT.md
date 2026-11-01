# PRODUCT — Wordt

## What it is

Wordt is a multiplayer party word game. Friends gather around one big screen (the
**TV client**) and each plays on their own phone (the **phone client**). One
machine runs the authoritative game server; the TV only ever displays what the
server says and holds no player seat.

## The loop

1. **Pick letters.** Every player chooses a share of the alphabet (15 each for
   two players, 10 for three+; 5 each in team mode). Letters two or more players
   picked become the **overlap pool**; the computer tops it to a fixed 15 with
   random letters nobody overlapped on.

2. **Read the value table.** Overlap letters are ranked by how many players
   picked them (ties broken by English frequency, consonants and vowels ranked
   inside their own groups). Consonants spread over 5 tiers (1–5), vowels over 2
   (1–2). Computer-added letters score their Scrabble value. A **rare letter**
   is drawn once per game and is worth +10.

3. **Make words.** Every player types words from pool letters (letters reuse
   inside a word). A word scores the sum of its letter values. Submissions are
   rejected in order: too short, unusable letter, duplicate, not in dictionary.

4. **Review.** The round is scored on the server and revealed one step at a time
   on the TV: the rare letter, unique words, the most-used word, stat bonuses,
   draft penalties, a spotlight on the five best unsubmitted words (with part of
   speech and a short definition), then the standings. The TV also shows a live
   feed of accepted words and a progress bar per player's letter pick during play.

## Personality

The TV plays like a **game show**: pool letters on bright contrasting tiles, a
semi-transparent clock counting the phase down, standings that crown the leader
and mark rank moves, a split battle bar for team play, a live feed that flags hot
streaks and big words, and final results landing on a podium with medals and
confetti. The phone is the **contestant's controller** — picking letters, typing
words, locking in. Competitive but social and fun; energetic, not solemn.

## Surfaces

- **Phone client** (`client-play/`, Vite + React, port 5173): the player
  controller. Screens: Join (room code / create), Lobby (room code, players, host
  controls, round length, round count, teams), Pick (letter keyboard), Value
  Table, Words (composer + word list + score), Review (reveal steps), Results
  (standings + winner celebration), How to Play (illustrated carousel).
- **TV client** (`client-tv/`, Vite + React, port 5174): display-only. Screens:
  Room entry, Lobby (code + QR + players), Pick (per-player progress), Value
  Table (big tiles), Words (board + live feed + writers), Notice, Review (reveal
  sequence), Results (podium + standings + confetti), How to Play.

## Constraints

- The server is authoritative. Clients send intents, receive acks, and get
  pushed `state`/`own` snapshots. Clients never compute a score.
- The TV never affects the game. All host controls live on the host's phone.
- Both clients share the same visual system for consistency.
- Letter tiles are the game's central object and should stay recognizable.
- The how-to-play carousel images in `public/how-to-play/` are existing assets.
- Phases: `LOBBY → PICKING → VALUE_TABLE → WORDS → NOTICE → REVIEW → RESULTS`,
  repeating per round, ending in `GAME_OVER`.

## Audience and scene

Friends at a gathering — a living room, a bar, a classroom. One person hosts.
Phones are held in hand under mixed lighting; the TV is across the room and must
read clearly at distance. The mood is a party, not a test.
