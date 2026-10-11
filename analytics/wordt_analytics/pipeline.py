"""The sync pipeline: fetch logs, keep new events, rebuild the summary tabs."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import timedelta
from typing import Any, Callable

from . import aggregate
from .config import Config
from .events import extract_events, load_events_file, new_events
from .models import WordtEvent, iso, parse_ts, utc_now
from .render_api import RenderClient
from .sheets import GspreadStore, SheetStore

META_LAST_TIMESTAMP = "lastProcessedTimestamp"
META_LAST_RUN = "lastRunAt"
META_EVENTS_TOTAL = "eventsTotal"

# How far back to re-query when resuming from the stored cursor. Render's
# pagination can re-serve boundary logs, and a small overlap costs nothing
# because events are de-duplicated by content hash.
DEFAULT_OVERLAP_MINUTES = 10

ClientFactory = Callable[[Config], Any]


@dataclass
class RunResult:
    window_start: str
    window_end: str
    fetched_events: int
    new_events: int
    total_events: int
    tables: dict[str, list[list[str]]] = field(default_factory=dict)
    dry_run: bool = False


def default_client(config: Config) -> RenderClient:
    return RenderClient(
        api_key=config.render_api_key or "",
        owner_id=config.render_owner_id or "",
        resource_ids=[config.render_service_id or ""],
        base_url=config.render_api_url,
    )


def run(
    config: Config,
    store: SheetStore,
    *,
    client: Any | None = None,
    events_file: str | None = None,
    window_hours: float = 24,
    start: str | None = None,
    end: str | None = None,
    dry_run: bool = False,
    now: Any | None = None,
    overlap_minutes: int = DEFAULT_OVERLAP_MINUTES,
    client_factory: ClientFactory = default_client,
) -> RunResult:
    now = now or utc_now()
    meta = store.read_meta()

    window_end = end or iso(now)
    if start:
        window_start = start
    elif meta.get(META_LAST_TIMESTAMP):
        window_start = iso(parse_ts(meta[META_LAST_TIMESTAMP]) - timedelta(minutes=overlap_minutes))
    else:
        window_start = iso(now - timedelta(hours=window_hours))

    fetched: list[WordtEvent]
    if events_file:
        events = load_events_file(events_file)
        fetched = len(events)
    else:
        if client is None:
            client = default_client(config)
        events = extract_events(client.fetch_logs(window_start, end if end is not None else iso(now)))
        fetched = len(events)

    existing = store.read_events()
    seen = {event.event_id for event in existing}
    fresh = new_events(events, seen)

    if not dry_run and fresh:
        store.append_events(fresh)

    all_events = existing + fresh
    tables = {
        "Games": aggregate.build_games(all_events),
        "Words": aggregate.build_words(all_events),
        "Letters": aggregate.build_letters(all_events),
        "Rejections": aggregate.build_rejections(all_events),
    }

    if not dry_run:
        store.replace_table("Games", aggregate.GAMES_HEADERS, tables["Games"])
        store.replace_table("Words", aggregate.WORDS_HEADERS, tables["Words"])
        store.replace_table("Letters", aggregate.LETTERS_HEADERS, tables["Letters"])
        store.replace_table("Rejections", aggregate.REJECTIONS_HEADERS, tables["Rejections"])

        meta_update = dict(store.read_meta())
        latest = _latest_timestamp(all_events)
        if latest:
            meta_update[META_LAST_TIMESTAMP] = latest
        meta_update[META_LAST_RUN] = iso(now)
        meta_update[META_EVENTS_TOTAL] = str(len(all_events))
        store.write_meta(meta_update)

    return RunResult(
        window_start=window_start,
        window_end=end or iso(now),
        fetched_events=len(events),
        new_events=len(fresh),
        total_events=len(all_events),
        tables=tables,
        dry_run=dry_run,
    )


def _latest_timestamp(events: list[WordtEvent]) -> str | None:
    latest_dt = None
    latest_raw = None
    for event in events:
        try:
            dt = parse_ts(event.timestamp)
        except ValueError:
            continue
        if latest_dt is None or dt > latest_dt:
            latest_dt = dt
            latest_raw = event.timestamp
    return latest_raw


def build_store(config: Config) -> SheetStore:
    return GspreadStore(config.service_account or {}, config.sheet_id)
