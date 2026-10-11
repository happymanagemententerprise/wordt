"""Event model and small time helpers shared by the rest of the package."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Mapping

# The event types the server writes (see README "Analytics log" and
# server/src/room.ts). Anything else in the stdout stream is ignored.
KNOWN_TYPES = (
    "game_start",
    "picks_locked",
    "pool_built",
    "word_submitted",
    "rare_letter_used",
    "round_scored",
    "game_over",
)

# Fields lifted into their own columns on the Events sheet. Everything else the
# event carried is kept as JSON in the `details` column.
RESERVED_KEYS = ("ts", "gameId", "roomCode", "round", "type", "playerId")

EVENTS_HEADERS = (
    "event_id",
    "timestamp",
    "gameId",
    "roomCode",
    "round",
    "type",
    "playerId",
    "details",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    """Format a datetime as an RFC 3339 UTC string (``...Z``)."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def parse_ts(value: str) -> datetime:
    """Parse a timestamp from the log or the sheet. Raises ``ValueError`` if bad."""
    text = value.strip()
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def event_id_for(
    timestamp: str,
    game_id: str | None,
    round_: int | None,
    type_: str,
    player_id: str | None,
    details: Mapping[str, Any],
) -> str:
    """A stable id derived purely from an event's content.

    Two identical events would collide, which is fine: they would be
    indistinguishable anyway. Because the id does not depend on Render's log id,
    it is the same whether the event came from the API or a local file, so a
    re-run that overlaps an earlier window never doubles a row.
    """
    payload = "|".join(
        [
            timestamp,
            game_id or "",
            "" if round_ is None else str(round_),
            type_,
            player_id or "",
            json.dumps(dict(details), sort_keys=True, separators=(",", ":")),
        ]
    )
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _coerce_round(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return None


@dataclass(frozen=True)
class WordtEvent:
    event_id: str
    timestamp: str
    game_id: str | None
    room_code: str | None
    round: int | None
    type: str
    player_id: str | None
    details: Mapping[str, Any] = field(default_factory=dict)

    def get(self, key: str, default: Any = None) -> Any:
        return self.details.get(key, default)

    def to_row(self) -> list[str]:
        return [
            self.event_id,
            self.timestamp,
            self.game_id or "",
            self.room_code or "",
            "" if self.round is None else str(self.round),
            self.type,
            self.player_id or "",
            json.dumps(dict(self.details), sort_keys=True, separators=(",", ":")),
        ]

    @classmethod
    def from_row(cls, row: list[str]) -> "WordtEvent":
        padded = list(row) + [""] * (len(EVENTS_HEADERS) - len(row))
        raw_round = padded[4]
        details: Mapping[str, Any]
        try:
            parsed = json.loads(padded[7]) if padded[7] else {}
        except ValueError:
            parsed = {}
        details = parsed if isinstance(parsed, dict) else {}
        return cls(
            event_id=padded[0],
            timestamp=padded[1],
            game_id=padded[2] or None,
            room_code=padded[3] or None,
            round=_coerce_round(int(raw_round)) if raw_round.isdigit() else None,
            type=padded[5],
            player_id=padded[6] or None,
            details=details,
        )


def event_from_dict(obj: Mapping[str, Any]) -> WordtEvent | None:
    """Turn one parsed log line into a :class:`WordtEvent`.

    Returns ``None`` for anything that is not one of the game's analytics events
    (server chatter, Render's own request logs, truncated lines, ...).
    """
    event_type = obj.get("type")
    if not isinstance(event_type, str) or event_type not in KNOWN_TYPES:
        return None

    timestamp = obj.get("ts")
    if not isinstance(timestamp, str) or timestamp.strip() == "":
        return None
    try:
        parse_ts(timestamp)
    except ValueError:
        return None

    game_id = obj.get("gameId") if isinstance(obj.get("gameId"), str) else None
    room_code = obj.get("roomCode") if isinstance(obj.get("roomCode"), str) else None
    player_id = obj.get("playerId") if isinstance(obj.get("playerId"), str) else None
    round_ = _coerce_round(obj.get("round"))

    details = {key: value for key, value in obj.items() if key not in RESERVED_KEYS}
    return WordtEvent(
        event_id=event_id_for(timestamp, game_id, round_, event_type, player_id, details),
        timestamp=timestamp,
        game_id=game_id,
        room_code=room_code,
        round=round_,
        type=event_type,
        player_id=player_id,
        details=details,
    )
