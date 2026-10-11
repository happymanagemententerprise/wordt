"""Turn raw Render log entries (or a local JSONL file) into game events."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping

from .models import WordtEvent, event_from_dict


def iter_json_objects(lines: Iterable[str]) -> Iterator[Mapping[str, Any]]:
    """Yield every JSON object found in a stream of text lines."""
    for line in lines:
        text = line.strip()
        if not text.startswith("{"):
            continue
        try:
            parsed = json.loads(text)
        except ValueError:
            continue
        if isinstance(parsed, dict):
            yield parsed


def extract_events(raw_logs: Iterable[Mapping[str, Any]]) -> list[WordtEvent]:
    """Keep only the game's analytics events from raw Render log entries."""
    events: list[WordtEvent] = []
    for entry in raw_logs:
        message = entry.get("message")
        if not isinstance(message, str):
            continue
        for obj in iter_json_objects(message.splitlines() or [message]):
            event = event_from_dict(obj)
            if event is not None:
                events.append(event)
    return events


def load_events_file(path: str | Path) -> list[WordtEvent]:
    """Read a local JSONL analytics log (as written by the server) into events."""
    text = Path(path).read_text(encoding="utf-8")
    events: list[WordtEvent] = []
    for obj in iter_json_objects(text.splitlines()):
        event = event_from_dict(obj)
        if event is not None:
            events.append(event)
    return events


def new_events(events: Iterable[WordtEvent], seen_ids: set[str]) -> list[WordtEvent]:
    """Filter out events already stored, preserving order and dropping in-run dups."""
    fresh: list[WordtEvent] = []
    for event in events:
        if event.event_id in seen_ids:
            continue
        seen_ids.add(event.event_id)
        fresh.append(event)
    return fresh
