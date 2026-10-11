from wordt_analytics.cli import main


def test_local_dry_run_succeeds(game_events_file, capsys):
    code = main(["--events-file", str(game_events_file), "--dry-run"])
    out = capsys.readouterr().out

    assert code == 0
    assert "new 11" in out
    assert "Games" in out
    # A dry run diff-previews the tables.
    assert "STORE" in out


def test_missing_config_exits_with_code_2(monkeypatch):
    for name in (
        "RENDER_API_KEY",
        "RENDER_SERVICE_ID",
        "RENDER_OWNER_ID",
        "GOOGLE_SERVICE_ACCOUNT_JSON",
    ):
        monkeypatch.delenv(name, raising=False)

    assert main([]) == 2


def test_rejects_unknown_flag():
    import pytest

    with pytest.raises(SystemExit):
        main(["--nope"])
