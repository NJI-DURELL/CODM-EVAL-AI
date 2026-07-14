import json
from pathlib import Path

import pytest

from app.ocr.codm_parser import OcrParseError, parse_scoreboard
from app.ocr.paddle_engine import OcrToken

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rank_tab_tokens.json"


def _load_tokens() -> list[OcrToken]:
    data = json.loads(FIXTURE_PATH.read_text())
    return [OcrToken(**row) for row in data]


def test_parses_all_nine_team_blocks_from_real_rank_tab_screenshot():
    blocks = parse_scoreboard(_load_tokens())
    assert len(blocks) == 9
    assert {b.ocr_label for b in blocks} == {
        "TEAM1",
        "TEAM4",
        "TEAM5",
        "TEAM8",
        "TEAM10",
        "TEAM14",
        "TEAM15",
        "TEAM17",
        "TEAM18",
    }


def test_pins_rank_1_team_with_all_four_players_and_kills():
    blocks = parse_scoreboard(_load_tokens())
    team1 = next(b for b in blocks if b.ocr_label == "TEAM1")
    assert team1.rank == 1
    assert [(p.ocr_name, p.kills) for p in team1.players] == [
        ("OG>KUSH", 17),
        ("OG>DAHMER", 23),
        ("OG>ChambasTT", 18),
        ("OG>DAMAGE", 7),
    ]


def test_falls_back_to_averaged_column_anchor_when_rank_badge_is_garbled():
    # TEAM14 and TEAM8 sit in a header band where their own rank badges OCR
    # to non-digit noise ("tT" / "1T") — the column must still be assigned
    # correctly via the other headers' badges in that column.
    blocks = parse_scoreboard(_load_tokens())
    team14 = next(b for b in blocks if b.ocr_label == "TEAM14")
    team8 = next(b for b in blocks if b.ocr_label == "TEAM8")
    assert [p.ocr_name for p in team14.players] == ["DByRn2.0", "DBOz", "SngTyrant"]
    assert team8.rank is None
    assert [p.ocr_name for p in team8.players] == [
        "Sng@slayyyy",
        "Sng@paul_biya",
        "SngNotNice",
        "SngBig-M-237",
    ]


def test_defaults_kills_to_zero_when_no_visible_number_token():
    blocks = parse_scoreboard(_load_tokens())
    team10 = next(b for b in blocks if b.ocr_label == "TEAM10")
    assert [(p.ocr_name, p.kills) for p in team10.players] == [("OG>MAMBA", 0)]


def test_empty_tokens_raise_parse_error():
    with pytest.raises(OcrParseError):
        parse_scoreboard([])


def test_tokens_with_no_team_headers_raise_parse_error():
    tokens = [OcrToken(text="561s", confidence=0.98, x_center=2249.0, y_center=141.0)]
    with pytest.raises(OcrParseError):
        parse_scoreboard(tokens)
