"""Wordt analytics: pull the game's event log out of Render and into a Google Sheet.

The server mirrors every analytics event to stdout as one JSON object per line
(see ``server/src/analytics.ts``). Render captures that stdout, and this package
reads it back through Render's Logs API, keeps only the game's events, and writes
them to a Google Sheet: a raw ``Events`` tab plus a few rolled-up tabs that are
recomputed on every run.

Entry point: ``python -m wordt_analytics`` (see :mod:`wordt_analytics.cli`).
"""

from __future__ import annotations

__all__ = ["__version__"]

__version__ = "0.1.0"
