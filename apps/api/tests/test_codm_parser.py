import json
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from app.ocr.codm_parser import OcrParseError, _classify_medal_color, parse_scoreboard
from app.ocr.paddle_engine import OcrToken

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "rank_tab_tokens.json"

# Sampled directly from real screenshots' rank badges (see codm_parser.py's
# MEDAL_COLORS) — the true medals plus several row-accent colors used by
# badges 4-9 in the same images, which must NOT be classified as a medal.
GOLD_RGB = (221, 173, 46)
SILVER_RGB = (154, 167, 201)
BRONZE_RGB = (168, 109, 60)
ROW_ACCENT_RGBS = [
    (81, 155, 169),  # teal, rank 4
    (161, 172, 93),  # olive, rank 5
    (152, 131, 155),  # purple-gray, rank 6
    (151, 94, 94),  # red, rank 7
    (171, 143, 142),  # salmon, rank 8
    (137, 81, 161),  # purple, rank 9
]


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


def test_classifies_real_medal_colors_correctly():
    assert _classify_medal_color(GOLD_RGB) == 1
    assert _classify_medal_color(SILVER_RGB) == 2
    assert _classify_medal_color(BRONZE_RGB) == 3


def test_does_not_misclassify_row_accent_colors_as_a_medal():
    for rgb in ROW_ACCENT_RGBS:
        assert _classify_medal_color(rgb) is None


def _paint_badge(image: Image.Image, x: float, y: float, color: tuple[int, int, int]) -> None:
    ImageDraw.Draw(image).rectangle([x - 20, y - 20, x + 20, y + 20], fill=color)


def test_medal_color_fills_in_rank_when_badge_digit_is_completely_unreadable():
    # No rank badge token at all for this header — simulates OCR losing the
    # digit entirely (not just misreading it), which pure text parsing can
    # never recover from. Badge color still can.
    tokens = [
        OcrToken(text="TEAM1", confidence=0.99, x_center=863.0, y_center=202.0),
        OcrToken(text="Player1", confidence=0.95, x_center=700.0, y_center=250.0),
        OcrToken(text="5", confidence=0.95, x_center=850.0, y_center=250.0),
    ]
    image = Image.new("RGB", (1000, 400), (10, 10, 10))
    _paint_badge(image, 863.0 - 346.0, 202.0 - 21.0, GOLD_RGB)

    blocks = parse_scoreboard(tokens, image=image)
    assert blocks[0].rank == 1


def test_medal_color_overrides_a_misread_digit():
    # The digit OCR'd as "7" but the badge is unmistakably gold — trust the
    # color, since misreads concentrate exactly on this stylized graphic.
    tokens = [
        OcrToken(text="7", confidence=0.6, x_center=517.0, y_center=181.0),
        OcrToken(text="TEAM1", confidence=0.99, x_center=863.0, y_center=202.0),
        OcrToken(text="Player1", confidence=0.95, x_center=700.0, y_center=250.0),
        OcrToken(text="5", confidence=0.95, x_center=850.0, y_center=250.0),
    ]
    image = Image.new("RGB", (1000, 400), (10, 10, 10))
    _paint_badge(image, 517.0, 181.0, GOLD_RGB)

    blocks = parse_scoreboard(tokens, image=image)
    assert blocks[0].rank == 1


def test_without_image_falls_back_to_pure_digit_ocr_unchanged():
    tokens = [
        OcrToken(text="TEAM1", confidence=0.99, x_center=863.0, y_center=202.0),
        OcrToken(text="Player1", confidence=0.95, x_center=700.0, y_center=250.0),
        OcrToken(text="5", confidence=0.95, x_center=850.0, y_center=250.0),
    ]
    blocks = parse_scoreboard(tokens)
    assert blocks[0].rank is None
