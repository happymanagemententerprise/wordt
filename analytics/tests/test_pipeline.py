from datetime import timedelta

from wordt_analytics.config import Config
from wordt_analytics.models import parse_ts
from wordt_analytics.pipeline import META_EVENTS_TOTAL, META_LAST_TIMESTAMP, run
from wordt_analytics.sheets import DryRunStore, InMemoryStore

DUMMY_CONFIG = Config(
    render_api_key=None,
    render_service_id=None,
    render_owner_id=None,
    render_api_url="https://api.render.com/v1",
    sheet_id="sheet",
    service_account=None,
)


class FakeClient:
    def __init__(self, logs=None):
        self._logs = logs or []
        self.calls = []

    def fetch_logs(self, start, end):
        self.calls.append((start, end))
        return list(self._logs)


def test_run_from_file_writes_events_and_tables(game_events_file):
    store = InMemoryStore()
    result = run(DUMMY_CONFIG, store, events_file=str(game_events_file))

    assert result.new_events == 11
    assert result.total_events == 11
    assert len(store.read_events()) == 11
    assert set(result.tables) == {"Games", "Words", "Letters", "Rejections"}
    assert len(store.tables["Games"][1]) == 1

    meta = store.read_meta()
    assert meta[META_EVENTS_TOTAL] == "11"
    assert meta[META_LAST_TIMESTAMP] == "2026-10-11T10:01:00.000Z"


def test_rerun_is_idempotent(game_events_file):
    store = InMemoryStore()
    run(DUMMY_CONFIG, store, events_file=str(game_events_file))
    second = run(DUMMY_CONFIG, store, events_file=str(game_events_file))

    assert second.new_events == 0
    assert second.total_events == 11
    assert len(store.read_events()) == 11
    # The summary tabs are rebuilt, not appended to.
    assert len(store.tables["Games"][1]) == 1


def test_dry_run_previews_without_writing(game_events_file):
    base = InMemoryStore()
    dry = DryRunStore(base)
    result = run(DUMMY_CONFIG, dry, events_file=str(game_events_file), dry_run=True)

    assert result.dry_run is True
    assert result.new_events == 11
    assert base.read_events() == []
    assert base.tables == {}
    assert base.meta == {}


def test_window_resumes_from_stored_cursor_with_overlap(game_events_file):
    store = InMemoryStore()
    run(DUMMY_CONFIG, store, events_file=str(game_events_file))

    client = FakeClient()
    run(DUMMY_CONFIG, store, client=client)

    assert len(client.calls) == 1
    start, _end = client.calls[0]
    expected = parse_ts("2026-10-11T10:01:00.000Z") - timedelta(minutes=10)
    assert parse_ts(start) == expected


def test_first_run_without_cursor_uses_window_hours():
    store = InMemoryStore()
    client = FakeClient()
    run(DUMMY_CONFIG, store, client=client, window_hours=3, now=parse_ts("2026-10-11T12:00:00Z"))

    start, end = client.calls[0]
    assert parse_ts(end) == parse_ts("2026-10-11T12:00:00Z")
    assert parse_ts(start) == parse_ts("2026-10-11T09:00:00Z")
