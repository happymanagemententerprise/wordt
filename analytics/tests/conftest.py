"""Shared fixtures: a small but realistic two-player game log."""

from __future__ import annotations

import pytest

GAME_ID = "g_11111111-1111-1111-1111-111111111111"
ROOM = "ABCDE"

# A 15-letter pool and the matching value table for the rounds below.
POOL = list("SETORAINHUDLCW")
LETTER_VALUES = {"S": 2, "T": 1, "O": 1, "R": 3, "E": 1, "A": 1, "N": 1, "D": 3, "L": 4, "C": 4, "M": 5, "W": 5}


def _event(ts: str, type_: str, *, round_: int | None, game: str = "g1", room: str = "ABCDE", **fields):
    return {"ts": ts, "gameId": game, "roomCode": room, "round": round_, "type": type_, **fields}


def sample_events() -> list[dict]:
    """Raw event dicts exactly as the server writes them to the log."""
    return [
        _event("2026-10-11T10:00:00.000Z", "game_start", round_=None, playerCount=2, teamMode=False, roundSeconds=30),
        _event("2026-10-11T10:00:01.000Z", "picks_locked", round_=1, playerId="p1", teamId=None, letters=["E", "T", "S", "O", "R", "E"], msIntoPickPhase=1200),
        _event("2026-10-11T10:00:02.000Z", "picks_locked", round_=1, playerId="p2", teamId=None, letters=["E", "T", "A", "O", "N", "E"], msIntoPickPhase=2400),
        _event(
            "2026-10-11T10:00:03.000Z",
            "pool_built",
            round_=1,
            pool=list(POOL),
            overlapLetters=["E", "T", "O"],
            computerAddedLetters=["D", "L", "C", "M", "W", "R", "S", "A", "N"],
            rareLetter="Z",
            letterValues={
                "entries": [{"letter": letter, "count": 1, "value": value} for letter, value in LETTER_VALUES.items()],
                "values": dict(LETTER_VALUES),
                "counts": {letter: 1 for letter in LETTER_VALUES},
                "source": {letter: "overlap" for letter in LETTER_VALUES},
            },
        ),
        _event("2026-10-11T10:00:05.000Z", "word_submitted", round_=1, playerId="p1", word="STORE", valid=True, countsAsWrongTry=False, points=8, msIntoRound=5000),
        _event("2026-10-11T10:00:06.000Z", "rare_letter_used", round_=1, playerId="p1", word="STORE"),
        _event("2026-10-11T10:00:07.000Z", "word_submitted", round_=1, playerId="p1", word="STORE", valid=False, reason="DUPLICATE", countsAsWrongTry=False, msIntoRound=7000),
        _event("2026-10-11T10:00:08.000Z", "word_submitted", round_=1, playerId="p2", word="SO", valid=False, reason="TOO_SHORT", countsAsWrongTry=True, msIntoRound=8000),
        _event("2026-10-11T10:00:09.000Z", "word_submitted", round_=1, playerId="p2", word="STONE", valid=True, countsAsWrongTry=False, points=6, msIntoRound=9000),
        _event(
            "2026-10-11T10:00:30.000Z",
            "round_scored",
            round_=1,
            players=[
                {"id": "p1", "baseScore": 8, "roundScore": 10, "totalScore": 10, "bonuses": [{"award": "most_unique_words", "points": 2}]},
                {"id": "p2", "baseScore": 6, "roundScore": 6, "totalScore": 6, "bonuses": []},
            ],
            mostUsedWords=["STORE"],
            rareLetter="Z",
            rareLetterWinners=["p1"],
        ),
        _event("2026-10-11T10:01:00.000Z", "game_over", round_=None, standings=[{"playerId": "p1", "score": 10, "validWordCount": 1}, {"playerId": "p2", "score": 6, "validWordCount": 1}], winners=["p1"]),
    ]


def parse_events(raw: list[dict]):
    from wordt_analytics.models import event_from_dict

    parsed = []
    for item in raw:
        event = event_from_dict(item)
        assert event is not None, item
        parsed.append(event)
    return parsed


@pytest.fixture
def raw_game_events() -> list[dict]:
    return sample_events()


@pytest.fixture
def game_events():
    return parse_events(sample_events())


@pytest.fixture
def game_events_file(tmp_path):
    import json

    path = tmp_path / "events.jsonl"
    path.write_text("\n".join(json.dumps(item) for item in sample_events()), encoding="utf-8")
    return path
