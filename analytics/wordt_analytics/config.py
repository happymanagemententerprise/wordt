"""Runtime configuration, read from the environment."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, Mapping

# The sheet this project writes to. Override with GOOGLE_SHEET_ID.
DEFAULT_SHEET_ID = "1qXlNgIBQPmarBqSUydPskk5hT6iEIhOGxNnYacxNX9Y"

DEFAULT_RENDER_API = "https://api.render.com/v1"


class ConfigError(RuntimeError):
    """Raised when required configuration is missing or malformed."""


def _require(env: Mapping[str, str], name: str, hint: str) -> str:
    value = (env.get(name) or "").strip()
    if not value:
        raise ConfigError(f"{name} is required ({hint}).")
    return value


@dataclass(frozen=True)
class Config:
    render_api_key: str | None
    render_service_id: str | None
    render_owner_id: str | None
    render_api_url: str
    sheet_id: str
    service_account: Mapping[str, Any] | None

    @property
    def has_render(self) -> bool:
        return bool(self.render_api_key and self.render_service_id and self.render_owner_id)

    @property
    def has_google(self) -> bool:
        return self.service_account is not None

    @classmethod
    def from_env(
        cls,
        env: Mapping[str, str] | None = None,
        *,
        require_render: bool = True,
        require_google: bool = True,
    ) -> "Config":
        env = env if env is not None else os.environ

        render_api_key = render_service_id = render_owner_id = None
        if require_render:
            render_api_key = _require(env, "RENDER_API_KEY", "Render API key")
            render_service_id = _require(
                env, "RENDER_SERVICE_ID", "the srv_ id of the Wordt web service"
            )
            render_owner_id = _require(env, "RENDER_OWNER_ID", "the workspace/owner id")

        service_account = None
        if require_google:
            raw = (env.get("GOOGLE_SERVICE_ACCOUNT_JSON") or "").strip()
            if not raw:
                raise ConfigError(
                    "GOOGLE_SERVICE_ACCOUNT_JSON is required (the service account JSON key)."
                )
            try:
                service_account = json.loads(raw)
            except ValueError as error:
                raise ConfigError(f"GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: {error}") from error
            if not isinstance(service_account, dict):
                raise ConfigError("GOOGLE_SERVICE_ACCOUNT_JSON must be a JSON object.")

        return cls(
            render_api_key=render_api_key,
            render_service_id=render_service_id,
            render_owner_id=render_owner_id,
            render_api_url=(env.get("RENDER_API_URL") or DEFAULT_RENDER_API).rstrip("/"),
            sheet_id=(env.get("GOOGLE_SHEET_ID") or "").strip() or DEFAULT_SHEET_ID,
            service_account=service_account,
        )
