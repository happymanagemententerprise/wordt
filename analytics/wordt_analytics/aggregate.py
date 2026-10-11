"""Roll individual events up into the summary tabs.

Every tab is rebuilt from the full set of stored events on each run, so the
summaries are always consistent with the Events tab and writing them again is
idempotent.
"""

from __future__ import annotations

from typing import Any, Iterable, Mapping

GAMES_HEADERS = (
    "gameId",
    "roomCode",
    "startedAt",
    "endedAt",
    "playerCount",
    "teamMode",
    "roundSeconds",
    "roundsPlayed",
    "winners",
    "finalStandings",
    "totalValidWords",
)
WORDS_HEADERS = ("word", "submissions", "valid", "invalid", "totalPoints", "avgPoints")
LETTERS_HEADERS = ("letter", "timesInPool", "timesPicked", "timesInValidWords", "pointsFromValidWords")
REJECTIONS_HEADERS = ("reason", "count", "wrongTries")
META_HEADERS = ("key", "value")

ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _by_game(events: Iterable[Any]) -> dict[str, list[Any]]:
    games: dict[str, list[Any]] = {}
    for event in events:
        if event.game_id:
            games.setdefault(event.game_id, []).append(event)
    return games


def build_games(events: Iterable[Any]) -> list[list[str]]:
    rows: list[list[str]] = []
    for game_id, group in _by_game(events).items():
        start = next((e for e in group if e.type == "game_start"), None)
        over = next((e for e in group if e.type == "game_over"), None)

        timestamps = [e.timestamp for e in group if e.timestamp]
        started_at = min(timestamps) if timestamps else ""
        ended_at = over.timestamp if over is not None else ""

        standings = over.get("standings", []) if over is not None else []
        standings = standings if isinstance(standings, list) else []
        winners = over.get("winners", []) if over is not None else []
        winners = winners if isinstance(winners, list) else []

        if standings:
            final = "; ".join(
                f"{_str(entry.get('playerId'))}:{_num(entry.get('score'))}" for entry in standings if isinstance(entry, Mapping)
            )
            total_words = sum(_int(entry.get("validWordCount")) for entry in standings if isinstance(entry, Mapping))
        else:
            final = ""
            total_words = sum(1 for e in group if e.type == "word_submitted" and e.get("valid") is True)

        rounds = [e.round for e in group if isinstance(e.round, int)]
        room_code = next((e.room_code for e in group if e.room_code), "")

        rows.append(
            [
                game_id,
                room_code,
                started_at,
                ended_at,
                _str(start.get("playerCount")) if start is not None else "",
                _bool(start.get("teamMode")) if start is not None else "",
                _str(start.get("roundSeconds")) if start is not None else "",
                _str(max(rounds)) if rounds else "0",
                ", ".join(_str(w) for w in winners),
                final,
                _str(total_words),
            ]
        )

    rows.sort(key=lambda row: row[2], reverse=True)
    return rows


def build_words(events: Iterable[Any]) -> list[list[str]]:
    stats: dict[str, dict[str, Any]] = {}
    for event in events:
        if event.type != "word_submitted":
            continue
        word = event.get("word")
        if not isinstance(word, str) or word.strip() == "":
            continue
        key = word.strip().upper()
        entry = stats.setdefault(key, {"submissions": 0, "valid": 0, "invalid": 0, "points": 0})
        entry["submissions"] += 1
        if event.get("valid") is True:
            entry["valid"] += 1
            entry["points"] += _int(event.get("points"))
        else:
            entry["invalid"] += 1

    rows: list[list[str]] = []
    for word, entry in stats.items():
        valid = entry["valid"]
        avg = round(entry["points"] / valid, 2) if valid else 0
        rows.append(
            [word, str(entry["submissions"]), str(valid), str(entry["invalid"]), str(entry["points"]), str(avg)]
        )
    rows.sort(key=lambda row: (-int(row[4]), -int(row[1]), row[0]))
    return rows


def build_letters(events: Iterable[Any]) -> list[list[str]]:
    in_pool: dict[str, int] = {}
    picked: dict[str, int] = {}
    in_words: dict[str, int] = {}
    points: dict[str, int] = {}

    values_by_round: dict[tuple[str | None, int | None], Mapping[str, Any]] = {}
    for event in events:
        if event.type == "pool_built":
            table = event.get("letterValues")
            values = table.get("values") if isinstance(table, Mapping) else None
            if isinstance(values, Mapping):
                values_by_round[(event.game_id, event.round)] = values

    for event in events:
        if event.type == "pool_built":
            for letter in _letters(event.get("pool")):
                in_pool[letter] = in_pool.get(letter, 0) + 1
        elif event.type == "picks_locked":
            for letter in _letters(event.get("letters")):
                picked[letter] = picked.get(letter, 0) + 1
        elif event.type == "word_submitted" and event.get("valid") is True:
            word = event.get("word")
            if not isinstance(word, str):
                continue
            values = values_by_round.get((event.game_id, event.round), {})
            for letter in word.strip().upper():
                if letter not in ALPHABET:
                    continue
                in_words[letter] = in_words.get(letter, 0) + 1
                points[letter] = points.get(letter, 0) + _int(values.get(letter))

    rows: list[list[str]] = []
    for letter in ALPHABET:
        rows.append(
            [
                letter,
                str(in_pool.get(letter, 0)),
                str(picked.get(letter, 0)),
                str(in_words.get(letter, 0)),
                str(points.get(letter, 0)),
            ]
        )
    return rows


def build_rejections(events: Iterable[Any]) -> list[list[str]]:
    stats: dict[str, dict[str, int]] = {}
    for event in events:
        if event.type != "word_submitted" or event.get("valid") is not False:
            continue
        reason = event.get("reason")
        reason = reason if isinstance(reason, str) and reason else "UNKNOWN"
        entry = stats.setdefault(reason, {"count": 0, "wrongTries": 0})
        entry["count"] += 1
        if event.get("countsAsWrongTry") is True:
            entry["wrongTries"] += 1

    rows = [[reason, str(entry["count"]), str(entry["wrongTries"])] for reason, entry in stats.items()]
    rows.sort(key=lambda row: (-int(row[1]), row[0]))
    return rows


def _letters(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip().upper() for item in value if isinstance(item, str) and item.strip()]


def _str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _bool(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return ""


def _int(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    return 0


def _num(value: Any) -> str:
    if isinstance(value, bool):
        return "0"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, (int, float)):
        return str(value)
    return "0"
