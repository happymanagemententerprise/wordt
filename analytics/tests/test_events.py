import json

from wordt_analytics.events import (
    extract_events,
    iter_json_objects,
    load_events_file,
    new_events,
)


def test_iter_json_objects_skips_noise():
    lines = [
        "[wordt] starting",
        json.dumps({"type": "game_start", "ts": "2026-10-11T10:00:00Z"}),
        "not json {",
        json.dumps(["a", "list"]),
    ]
    objects = list(iter_json_objects(lines))
    assert objects == [{"type": "game_start", "ts": "2026-10-11T10:00:00Z"}]


def test_extract_events_reads_only_game_events():
    good = json.dumps(
        {"ts": "2026-10-11T10:00:02Z", "gameId": "g1", "roomCode": "ABCDE", "round": 1, "type": "picks_locked", "playerId": "p1", "letters": ["E"], "msIntoPickPhase": 10}
    )
    raw_logs = [
        {"id": "1", "message": "GET /play 200", "timestamp": "2026-10-11T10:00:00Z", "labels": []},
        {"id": "2", "message": f"[wordt] {json.dumps({'type': 'unknown'})}", "timestamp": ""},
        {"id": "3", "message": good, "timestamp": "2026-10-11T10:00:00Z"},
        {"id": "4", "message": 12345},
    ]
    events = extract_events(raw_logs)
    assert len(events) == 1
    assert events[0].type == "picks_locked"
    assert events[0].player_id == "p1"


def test_extract_events_handles_multiline_messages(tmp_path):
    line = json.dumps({"type": "game_start", "ts": "2026-10-11T10:00:00Z", "playerCount": 2})
    logs = [{"id": "1", "message": f"prefix\n{line}\n"}]
    events = extract_events(logs)
    assert len(events) == 1
    assert events[0].get("playerCount") == 2


def test_load_events_file(tmp_path):
    path = tmp_path / "events.jsonl"
    path.write_text(
        "\n".join(
            [
                json.dumps({"type": "game_start", "ts": "2026-10-11T10:00:00Z"}),
                "a trailing non-json line",
                json.dumps({"type": "game_over", "ts": "2026-10-11T10:01:00Z"}),
            ]
        ),
        encoding="utf-8",
    )
    events = load_events_file(path)
    assert [event.type for event in events] == ["game_start", "game_over"]


def test_new_events_dedupes_against_seen_and_within_batch():
    from wordt_analytics.models import event_from_dict

    def make(ts, word):
        return event_from_dict({"ts": ts, "type": "word_submitted", "gameId": "g1", "round": 1, "playerId": "p1", "word": word})

    seen = {make("2026-10-11T10:00:00Z", "STORE").event_id}
    batch = [make("2026-10-11T10:00:00Z", "STORE"), make("2026-10-11T10:00:01Z", "STONE"), make("2026-10-11T10:00:01Z", "STONE")]
    fresh = new_events(batch, seen)
    assert [event.get("word") for event in fresh] == ["STONE"]
