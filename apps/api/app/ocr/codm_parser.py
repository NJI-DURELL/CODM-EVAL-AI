import re
from dataclasses import dataclass

from app.ocr.paddle_engine import OcrToken

PLACEMENT_PATTERNS = [
    re.compile(r"^(?:TOP|RANK|PLACE(?:MENT)?|NO\.?)\s*#?\s*(\d{1,2})$", re.IGNORECASE),
    re.compile(r"^#\s*(\d{1,2})$"),
]
BARE_NUMBER_PATTERN = re.compile(r"^\d{1,3}$")
# Tuned against real CODM squad-result screenshots; recalibrate per aspect ratio.
ROW_Y_TOLERANCE_PX = 18


class OcrParseError(Exception):
    pass


@dataclass
class ParsedPlayerRow:
    ocr_name: str
    kills: int


@dataclass
class ParsedScoreboard:
    placement: int | None
    players: list[ParsedPlayerRow]


def _extract_placement(tokens: list[OcrToken]) -> tuple[int | None, list[OcrToken]]:
    remaining = []
    placement = None
    for token in tokens:
        if placement is None:
            for pattern in PLACEMENT_PATTERNS:
                match = pattern.match(token.text.strip())
                if match:
                    placement = int(match.group(1))
                    break
            else:
                remaining.append(token)
                continue
            continue
        remaining.append(token)
    return placement, remaining


def _cluster_rows(tokens: list[OcrToken]) -> list[list[OcrToken]]:
    rows: list[list[OcrToken]] = []
    for token in sorted(tokens, key=lambda t: t.y_center):
        placed = False
        for row in rows:
            if abs(row[0].y_center - token.y_center) <= ROW_Y_TOLERANCE_PX:
                row.append(token)
                placed = True
                break
        if not placed:
            rows.append([token])
    return rows


def parse_scoreboard(tokens: list[OcrToken]) -> ParsedScoreboard:
    if not tokens:
        raise OcrParseError("No text detected in screenshot")

    placement, remaining = _extract_placement(tokens)
    rows = _cluster_rows(remaining)

    players: list[ParsedPlayerRow] = []
    for row in rows:
        row_sorted = sorted(row, key=lambda t: t.x_center)
        number_tokens = [t for t in row_sorted if BARE_NUMBER_PATTERN.match(t.text.strip())]
        name_tokens = [t for t in row_sorted if not BARE_NUMBER_PATTERN.match(t.text.strip())]
        if not name_tokens or not number_tokens:
            continue

        name = " ".join(t.text.strip() for t in name_tokens)
        kills = int(number_tokens[-1].text.strip())
        players.append(ParsedPlayerRow(ocr_name=name, kills=kills))

    if not players:
        raise OcrParseError("Could not identify any player rows in screenshot")

    return ParsedScoreboard(placement=placement, players=players)
