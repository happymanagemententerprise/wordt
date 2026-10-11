"""Command-line entry point: ``python -m wordt_analytics``."""

from __future__ import annotations

import argparse
import sys
from dataclasses import replace
from typing import Sequence

from . import __version__
from .config import Config, ConfigError
from .pipeline import default_client, run
from .sheets import DryRunStore, GspreadStore, InMemoryStore, SheetStore

MAX_PREVIEW_ROWS = 5


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="wordt-analytics",
        description="Sync Wordt's analytics events from Render logs into a Google Sheet.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="read and compute, but do not write anything to the sheet",
    )
    parser.add_argument(
        "--events-file",
        metavar="PATH",
        help="read a local JSONL analytics log instead of calling the Render API",
    )
    parser.add_argument(
        "--window-hours",
        type=float,
        default=24.0,
        help="how far back to look on the first run (default: 24)",
    )
    parser.add_argument("--start", metavar="ISO", help="explicit window start (overrides the stored cursor)")
    parser.add_argument("--end", metavar="ISO", help="explicit window end (defaults to now)")
    parser.add_argument("--sheet-id", metavar="ID", help="override GOOGLE_SHEET_ID")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    local_only = bool(args.events_file) and args.dry_run
    try:
        config = Config.from_env(
            require_render=args.events_file is None,
            require_google=not args.dry_run,
        )
    except ConfigError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    if args.sheet_id:
        config = replace(config, sheet_id=args.sheet_id)

    store, note = _build_store(config, dry_run=args.dry_run, local_only=local_only)
    client = None if args.events_file else default_client(config)

    try:
        result = run(
            config,
            store,
            client=client,
            events_file=args.events_file,
            window_hours=args.window_hours,
            start=args.start,
            end=args.end,
            dry_run=args.dry_run,
        )
    except Exception as error:  # surface a clean message; the workflow shows stdout
        print(f"error: {error}", file=sys.stderr)
        return 1

    _print_summary(result, note)
    return 0


def _build_store(config: Config, *, dry_run: bool, local_only: bool) -> tuple[SheetStore, str]:
    if local_only:
        return InMemoryStore(), "local file (no sheet access)"
    if config.has_google:
        base = GspreadStore(config.service_account or {}, config.sheet_id)
        if dry_run:
            return DryRunStore(base), "live sheet (read-only)"
        return base, "live sheet"
    return InMemoryStore(), "no sheet access"


def _print_summary(result, note: str) -> None:
    print(f"window {result.window_start} -> {result.window_end}")
    print(f"fetched {result.fetched_events}, new {result.new_events}, total {result.total_events} events")
    for title, rows in result.tables.items():
        print(f"  {title:<12} {len(rows)} rows")
    if result.dry_run:
        _print_preview(result.tables)
    else:
        print(f"wrote to the {note}.")


def _print_preview(tables: dict[str, list[list[str]]]) -> None:
    for title, rows in tables.items():
        if not rows:
            continue
        print(f"\n{title} (first {min(MAX_PREVIEW_ROWS, len(rows))} of {len(rows)}):")
        for row in rows[:MAX_PREVIEW_ROWS]:
            print("  " + " | ".join(row))


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
