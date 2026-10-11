from wordt_analytics import aggregate


def test_games_summary(game_events):
    rows = aggregate.build_games(game_events)
    assert len(rows) == 1
    row = rows[0]
    game_id, room, started, ended, players, team_mode, seconds, rounds, winners, final, total = row
    assert game_id == "g1"
    assert room == "ABCDE"
    assert started == "2026-10-11T10:00:00.000Z"
    assert ended == "2026-10-11T10:01:00.000Z"
    assert players == "2"
    assert team_mode == "false"
    assert seconds == "30"
    assert rounds == "1"
    assert winners == "p1"
    assert final == "p1:10; p2:6"
    assert total == "2"


def test_words_summary(game_events):
    rows = aggregate.build_words(game_events)
    by_word = {row[0]: row for row in rows}
    assert by_word["STORE"] == ["STORE", "2", "1", "1", "8", "8.0"]
    assert by_word["STONE"] == ["STONE", "1", "1", "0", "6", "6.0"]
    assert by_word["SO"] == ["SO", "1", "0", "1", "0", "0"]
    # sorted by total points, highest first
    assert [row[0] for row in rows] == ["STORE", "STONE", "SO"]


def test_letters_summary(game_events):
    rows = aggregate.build_letters(game_events)
    assert len(rows) == 26
    by_letter = {row[0]: row for row in rows}
    assert by_letter["E"] == ["E", "1", "4", "2", "2"]
    assert by_letter["S"] == ["S", "1", "1", "2", "4"]
    assert by_letter["Q"] == ["Q", "0", "0", "0", "0"]


def test_rejections_summary(game_events):
    rows = aggregate.build_rejections(game_events)
    by_reason = {row[0]: row for row in rows}
    assert by_reason["DUPLICATE"] == ["DUPLICATE", "1", "0"]
    assert by_reason["TOO_SHORT"] == ["TOO_SHORT", "1", "1"]


def test_empty_inputs_are_empty():
    assert aggregate.build_games([]) == []
    assert aggregate.build_words([]) == []
    assert aggregate.build_rejections([]) == []
    assert len(aggregate.build_letters([])) == 26
