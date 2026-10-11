"""Minimal client for Render's Logs API (``GET /v1/logs``).

Logs are paginated by time range: a response carries ``hasMore`` plus
``nextStartTime``/``nextEndTime`` to use for the next request. Results can
overlap between pages, so entries are de-duplicated by their log id.

Docs: https://api-docs.render.com/reference/list-logs
"""

from __future__ import annotations

import time
from typing import Any, Iterable, Mapping, Sequence

DEFAULT_BASE_URL = "https://api.render.com/v1"
PAGE_LIMIT = 100


class RenderError(RuntimeError):
    """Raised when Render's API cannot be reached or returns an error."""


class RenderClient:
    def __init__(
        self,
        api_key: str,
        owner_id: str,
        resource_ids: Sequence[str],
        *,
        base_url: str = DEFAULT_BASE_URL,
        session: Any | None = None,
        timeout: float = 30.0,
        max_pages: int = 60,
        retries: int = 3,
        sleep: Any = time.sleep,
    ) -> None:
        if not resource_ids:
            raise ValueError("at least one resource id is required")
        self._api_key = api_key
        self._owner_id = owner_id
        self._resource_ids = list(resource_ids)
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._max_pages = max_pages
        self._retries = retries
        self._sleep = sleep
        if session is None:
            try:
                import requests  # imported lazily so tests need not install it
            except ImportError as error:  # pragma: no cover - dependency guard
                raise RenderError("the 'requests' package is required") from error

            session = requests.Session()
        self._session = session

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}", "Accept": "application/json"}

    def _get(self, params: Mapping[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}/logs"
        last_error: Exception | None = None
        for attempt in range(self._retries):
            try:
                response = self._session.get(
                    url, headers=self._headers, params=params, timeout=self._timeout
                )
            except Exception as error:  # network errors are retried
                last_error = error
                self._sleep(min(2**attempt, 8))
                continue

            status = getattr(response, "status_code", 200)
            if status == 429 or 500 <= status < 600:
                last_error = RenderError(f"Render returned HTTP {status}")
                self._sleep(min(2**attempt, 8))
                continue
            if status >= 400:
                raise RenderError(f"Render returned HTTP {status}: {_body(response)}")

            try:
                data = response.json()
            except ValueError as error:
                raise RenderError(f"Render returned invalid JSON: {error}") from error
            if not isinstance(data, dict):
                raise RenderError("Render returned an unexpected payload")
            return data

        raise RenderError(f"Render request failed after {self._retries} attempts: {last_error}")

    def fetch_logs(self, start_time: str, end_time: str) -> list[dict[str, Any]]:
        """Return raw log entries between two RFC 3339 timestamps, oldest first."""
        collected: list[dict[str, Any]] = []
        seen_ids: set[str] = set()
        cursor = start_time
        seen_cursors: set[str] = set()

        for _ in range(self._max_pages):
            data = self._get(
                {
                    "ownerId": self._owner_id,
                    "resource": self._resource_ids,
                    "direction": "forward",
                    "startTime": cursor,
                    "endTime": end_time,
                    "limit": PAGE_LIMIT,
                }
            )
            for entry in _as_list(data.get("logs")):
                if not isinstance(entry, dict):
                    continue
                key = str(entry.get("id") or id(entry))
                if key in seen_ids:
                    continue
                seen_ids.add(key)
                collected.append(entry)

            if not data.get("hasMore"):
                break
            next_cursor = data.get("nextStartTime")
            if not isinstance(next_cursor, str) or next_cursor in seen_cursors:
                break
            seen_cursors.add(next_cursor)
            cursor = next_cursor

        return collected


def _as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _body(response: Any) -> str:
    text = getattr(response, "text", "")
    return text[:200] if isinstance(text, str) else ""
