from wordt_analytics.sheets import DryRunStore, InMemoryStore


def test_in_memory_store_round_trip(game_events):
    store = InMemoryStore()
    assert store.read_events() == []

    assert store.append_events(game_events[:2]) == 2
    assert len(store.read_events()) == 2

    store.write_meta({"lastProcessedTimestamp": "2026-10-11T10:00:00Z"})
    assert store.read_meta()["lastProcessedTimestamp"] == "2026-10-11T10:00:00Z"

    store.replace_table("Words", ("word",), [["STORE"]])
    assert store.tables["Words"] == (("word",), [["STORE"]])


def test_dry_run_store_reads_through_but_writes_nothing(game_events):
    base = InMemoryStore(events=game_events[:2], meta={"lastProcessedTimestamp": "yesterday"})
    dry = DryRunStore(base)

    assert len(dry.read_events()) == 2
    assert dry.read_meta()["lastProcessedTimestamp"] == "yesterday"

    dry.append_events(game_events[2:4])
    dry.replace_table("Games", ("gameId",), [["g1"]])
    dry.write_meta({"lastRunAt": "now"})

    # The underlying store is untouched.
    assert len(base.events) == 2
    assert "Games" not in base.tables
    assert base.meta == {"lastProcessedTimestamp": "yesterday"}

    # The dry-run store kept the would-be writes.
    assert dry.tables["Games"] == (("gameId",), [["g1"]])
    assert dry.meta == {"lastRunAt": "now"}
