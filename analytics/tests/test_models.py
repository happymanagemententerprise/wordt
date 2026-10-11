from wordt_analytics.models import (
    WordtEvent,
    event_from_dict,
    event_id_for,
    iso,
    parse_ts,
)


def test_parses_a_known_event_and_splits_details():
    obj = {
        "ts": "2026-10-11T10:00:05.000Z",
        "gameId": "g1",
        "roomCode": "ABCDE",
        "round": 1,
        "type": "word_submitted",
        "playerId": "p1",
        "word": "STORE",
        "valid": True,
        "points": 8,
    }
    event = event_from_dict(obj)
    assert event is not None
    assert event.type == "word_submitted"
    assert event.game_id == "g1"
    assert event.room_code == "ABCDE"
    assert event.round == 1
    assert event.player_id == "p1"
    assert event.get("word") == "STORE"
    assert event.get("points") == 8
    for reserved in ("ts", "gameId", "roomCode", "round", "type", "playerId"):
        assert reserved not in event.details


def test_ignores_unknown_types_and_non_events():
    assert event_from_dict({"type": "GET /play", "ts": "2026-10-11T10:00:00Z"}) is None
    assert event_from_dict({"ts": "2026-10-11T10:00:00Z"}) is None
    assert event_from_dict({"type": "game_start", "ts": ""}) is None
    assert event_from_dict({"type": "game_start", "ts": "not-a-date"}) is None


def test_round_may_be_null():
    event = event_from_dict({"ts": "2026-10-11T10:00:00Z", "type": "game_start", "round": None})
    assert event is not None
    assert event.round is None


def test_event_id_is_stable_regardless_of_key_order():
    first = event_id_for("2026-10-11T10:00:00Z", "g1", 1, "word_submitted", "p1", {"word": "STORE", "points": 8})
    second = event_id_for("2026-10-11T10:00:00Z", "g1", 1, "word_submitted", "p1", {"points": 8, "word": "STORE"})
    assert first == second
    assert len(first) == 40  # sha1 hex


def test_row_round_trip():
    obj = {
        "ts": "2026-10-11T10:00:00Z",
        "gameId": "g1",
        "roomCode": "ABCDE",
        "round": 2,
        "type": "pool_built",
        "pool": ["E", "T"],
    }
    event = event_from_dict(obj)
    assert event is not None
    row = event.to_row()
    assert row[5] == "pool_built"
    again = WordtEvent.from_row(row)
    assert again.event_id == event.event_id
    assert again.round == 2
    assert again.details == dict(event.details)


def test_iso_and_parse_round_trip():
    from datetime import datetime, timezone

    dt = datetime(2026, 10, 11, 10, 0, 0, tzinfo=timezone.utc)
    assert iso(dt) == "2026-10-11T10:00:00.000Z"
    assert parse_ts("2026-10-11T10:00:00.000Z") == dt
    assert parse_ts("2026-10-11T10:00:00+00:00") == dt
