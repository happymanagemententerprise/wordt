"""Google Sheets (and in-memory) destinations for the analytics tables.

The rest of the package only talks to the small :class:`SheetStore` interface,
which keeps the pipeline testable without touching Google (see
:class:`InMemoryStore`) and lets a dry run read real state while suppressing
writes (:class:`DryRunStore`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Protocol, Sequence

from .aggregate import META_HEADERS
from .models import EVENTS_HEADERS, WordtEvent

EVENTS_SHEET = "Events"
META_SHEET = "Meta"


class SheetStore:
    """The read/write surface the pipeline needs."""

    def read_events(self) -> list[WordtEvent]:  # pragma: no cover - interface
        raise NotImplementedError

    def append_events(self, events: list[WordtEvent]) -> int:
        raise NotImplementedError

    def read_meta(self) -> dict[str, str]:
        raise NotImplementedError

    def write_meta(self, meta: dict[str, str]) -> None:
        raise NotImplementedError

    def replace_table(self, title: str, headers: tuple[str, ...], rows: list[list[str]]) -> None:
        raise NotImplementedError


class InMemoryStore(SheetStore):
    """A store backed by plain lists, for tests and dry runs."""

    def __init__(self, events: list | None = None, meta: dict[str, str] | None = None) -> None:
        from .models import WordtEvent

        self.events: list[WordtEvent] = list(events or [])
        self.meta: dict[str, str] = dict(meta or {})
        self.tables: dict[str, tuple[tuple[str, ...], list[list[str]]]] = {}

    def read_events(self) -> list:
        return list(self.events)

    def append_events(self, events: list) -> int:
        self.events.extend(events)
        return len(events)

    def read_meta(self) -> dict[str, str]:
        return dict(self.meta)

    def write_meta(self, meta: dict[str, str]) -> None:
        self.meta = dict(meta)

    def replace_table(self, title: str, headers: tuple[str, ...], rows: list[list[str]]) -> None:
        self.tables[title] = (tuple(headers), [list(row) for row in rows])


class DryRunStore(SheetStore):
    """Read through to a real store, but keep every write in memory."""

    def __init__(self, inner: SheetStore) -> None:
        self._inner = inner
        self.appended: list = []
        self.meta: dict[str, str] = {}
        self.tables: dict[str, tuple[tuple[str, ...], list[list[str]]]] = {}

    def read_events(self) -> list:
        return self._inner.read_events()

    def append_events(self, events: list) -> int:
        self.appended.extend(events)
        return len(events)

    def read_meta(self) -> dict[str, str]:
        return self._inner.read_meta()

    def write_meta(self, meta: dict[str, str]) -> None:
        self.meta = dict(meta)

    def replace_table(self, title: str, headers: tuple[str, ...], rows: list[list[str]]) -> None:
        self.tables[title] = (headers, rows)


class GspreadStore(SheetStore):
    """Writes to a Google Sheet through ``gspread`` + a service account."""

    def __init__(self, service_account: Mapping[str, object], sheet_id: str, client: object | None = None) -> None:
        try:
            import gspread
        except ImportError as error:  # pragma: no cover - dependency guard
            raise RuntimeError("the 'gspread' package is required") from error

        self._gspread = gspread
        self._client = client if client is not None else gspread.service_account_from_dict(dict(service_account))
        self._book = self._client.open_by_key(sheet_id)

    def _worksheet(self, title: str, headers: tuple[str, ...] | None = None):
        gspread = self._gspread
        try:
            worksheet = self._book.worksheet(title)
        except gspread.exceptions.WorksheetNotFound:
            worksheet = self._book.add_worksheet(
                title=title, rows=1000, cols=max(len(headers or ()), 8)
            )
        if headers is not None:
            existing = worksheet.get_all_values()
            if not existing or not any(cell != "" for cell in existing[0]):
                worksheet.update(values=[list(headers)], range_name="A1")
        return worksheet

    def read_events(self) -> list:
        from .models import WordtEvent

        worksheet = self._worksheet("Events", EVENTS_HEADERS)
        values = worksheet.get_all_values()
        if not values:
            return []
        return [WordtEvent.from_row(row) for row in values[1:] if any(cell for cell in row)]

    def append_events(self, events: list) -> int:
        if not events:
            return 0
        worksheet = self._worksheet("Events", EVENTS_HEADERS)
        worksheet.append_rows([event.to_row() for event in events], value_input_option="RAW")
        return len(events)

    def read_meta(self) -> dict[str, str]:
        worksheet = self._worksheet("Meta", ("key", "value"))
        rows = worksheet.get_all_values()
        meta: dict[str, str] = {}
        for row in rows[1:]:
            padded = list(row) + ["", ""]
            if padded[0]:
                meta[padded[0]] = padded[1]
        return meta

    def write_meta(self, meta: dict[str, str]) -> None:
        self.replace_table("Meta", ("key", "value"), [[key, value] for key, value in sorted(meta.items())])

    def replace_table(self, title: str, headers: tuple[str, ...], rows: list[list[str]]) -> None:
        worksheet = self._worksheet(title, headers)
        worksheet.clear()
        worksheet.update(values=[list(headers), *rows], range_name="A1")
