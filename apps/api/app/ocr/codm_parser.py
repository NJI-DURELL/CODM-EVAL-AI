import re
from dataclasses import dataclass

from app.ocr.paddle_engine import OcrToken

TEAM_LABEL_PATTERN = re.compile(r"^TEAM(\d+)$", re.IGNORECASE)
BARE_NUMBER_PATTERN = re.compile(r"^\d{1,3}$")
RANK_BADGE_PATTERN = re.compile(r"^\d{1,2}$")

# Tuned against real CODM RANK-tab screenshots (see tests/test_codm_parser.py);
# recalibrate per aspect ratio / UI scale if extraction quality drops.
ROW_Y_TOLERANCE_PX = 18
HEADER_BAND_Y_TOLERANCE_PX = 30
COLUMN_CLUSTER_THRESHOLD_PX = 250
COLUMN_BOUNDARY_SLACK_PX = 20
MAX_PLAYERS_PER_TEAM = 4


class OcrParseError(Exception):
    pass


@dataclass
class ParsedPlayerRow:
    ocr_name: str
    kills: int


@dataclass
class ParsedTeamBlock:
    rank: int | None
    ocr_label: str
    players: list[ParsedPlayerRow]


@dataclass
class _Header:
    rank: int | None
    label: str
    label_token: OcrToken
    column: int


def _cluster_1d(values: list[float], threshold: float) -> list[list[int]]:
    """Greedily groups value indices within `threshold` of each cluster's
    running average. Good enough for well-separated bands like this UI's
    header rows / grid columns — not a general-purpose clustering algorithm.
    """
    order = sorted(range(len(values)), key=lambda i: values[i])
    clusters: list[list[int]] = []
    cluster_avgs: list[float] = []
    for i in order:
        v = values[i]
        for c_idx, avg in enumerate(cluster_avgs):
            if abs(v - avg) <= threshold:
                clusters[c_idx].append(i)
                cluster_avgs[c_idx] = avg + (v - avg) / len(clusters[c_idx])
                break
        else:
            clusters.append([i])
            cluster_avgs.append(v)
    return clusters


def _cluster_rows(tokens: list[OcrToken], tolerance: float) -> list[list[OcrToken]]:
    rows: list[list[OcrToken]] = []
    for token in sorted(tokens, key=lambda t: t.y_center):
        for row in rows:
            if abs(row[0].y_center - token.y_center) <= tolerance:
                row.append(token)
                break
        else:
            rows.append([token])
    return rows


def _row_to_player(row: list[OcrToken]) -> ParsedPlayerRow | None:
    row_sorted = sorted(row, key=lambda t: t.x_center)
    number_tokens = [t for t in row_sorted if BARE_NUMBER_PATTERN.match(t.text.strip())]
    name_tokens = [t for t in row_sorted if not BARE_NUMBER_PATTERN.match(t.text.strip())]
    if not name_tokens:
        return None
    name = " ".join(t.text.strip() for t in name_tokens)
    # A 0-kill row sometimes renders without a visible "0" token in this UI —
    # default to 0 rather than dropping the player.
    kills = int(number_tokens[-1].text.strip()) if number_tokens else 0
    return ParsedPlayerRow(ocr_name=name, kills=kills)


def _extract_headers(tokens: list[OcrToken]) -> tuple[list[_Header], set[int], list[float]]:
    """Finds every "TEAMn" token and pairs it with the rank badge (a bare
    1-2 digit number) sitting just above it in the same header band.

    Columns are grouped by label x-position, which OCR reads reliably
    (>=0.95 confidence on every sample). Rank badges are used to anchor each
    column's left boundary (needed because player names/kills sit far to
    either side of the header's own x position within the same visual
    column) — but a badge occasionally misreads as non-digit noise, so the
    per-column anchor is averaged across every header instance of that
    column that *did* get a valid badge, rather than trusting any single
    header's own badge.
    """
    team_tokens = [t for t in tokens if TEAM_LABEL_PATTERN.match(t.text.strip())]
    if not team_tokens:
        return [], set(), []
    rank_tokens = [t for t in tokens if RANK_BADGE_PATTERN.match(t.text.strip())]

    header_pool = team_tokens + rank_tokens
    y_values = [t.y_center for t in header_pool]

    raw: list[tuple[int | None, OcrToken, OcrToken | None]] = []
    consumed_ids: set[int] = set()
    for band_indices in _cluster_1d(y_values, HEADER_BAND_Y_TOLERANCE_PX):
        band = sorted((header_pool[i] for i in band_indices), key=lambda t: t.x_center)
        pending_rank: int | None = None
        pending_badge: OcrToken | None = None
        for token in band:
            if TEAM_LABEL_PATTERN.match(token.text.strip()):
                raw.append((pending_rank, token, pending_badge))
                pending_rank, pending_badge = None, None
            else:
                pending_rank = int(token.text.strip())
                pending_badge = token

    if not raw:
        return [], set(), []

    label_clusters = _cluster_1d(
        [label.x_center for _, label, _ in raw], COLUMN_CLUSTER_THRESHOLD_PX
    )

    badge_offsets = [
        label.x_center - badge.x_center for _, label, badge in raw if badge is not None
    ]
    typical_offset = sum(badge_offsets) / len(badge_offsets) if badge_offsets else 0.0

    column_anchors: list[float] = []
    for cluster in label_clusters:
        badge_xs = [badge.x_center for i in cluster if (badge := raw[i][2]) is not None]
        if badge_xs:
            column_anchors.append(sum(badge_xs) / len(badge_xs))
        else:
            label_avg = sum(raw[i][1].x_center for i in cluster) / len(cluster)
            column_anchors.append(label_avg - typical_offset)

    cluster_order = sorted(range(len(column_anchors)), key=lambda i: column_anchors[i])
    boundaries = [column_anchors[i] for i in cluster_order]
    cluster_to_column = {
        raw_index: column
        for column, cluster_idx in enumerate(cluster_order)
        for raw_index in label_clusters[cluster_idx]
    }

    headers = [
        _Header(rank=rank, label=label.text.strip(), label_token=label, column=cluster_to_column[i])
        for i, (rank, label, _badge) in enumerate(raw)
    ]
    for _, label, badge in raw:
        consumed_ids.add(id(label))
        if badge is not None:
            consumed_ids.add(id(badge))

    return headers, consumed_ids, boundaries


def _assign_column(x: float, boundaries: list[float]) -> int:
    column = 0
    for i, boundary in enumerate(boundaries):
        if x >= boundary - COLUMN_BOUNDARY_SLACK_PX:
            column = i
        else:
            break
    return column


def parse_scoreboard(tokens: list[OcrToken]) -> list[ParsedTeamBlock]:
    """Parses CODM's RANK-tab results screen: a grid of up to 9 visible
    team blocks (rank badge + "TEAMn" label + 2-4 players with kills), 3
    per row, with more reachable by scrolling — very different from a
    single-squad result card. One screenshot can yield multiple teams.
    """
    if not tokens:
        raise OcrParseError("No text detected in screenshot")

    headers, consumed_ids, boundaries = _extract_headers(tokens)
    if not headers:
        raise OcrParseError("Could not find any team headers in screenshot")

    remaining = [t for t in tokens if id(t) not in consumed_ids]
    by_column: dict[int, list[OcrToken]] = {}
    for token in remaining:
        by_column.setdefault(_assign_column(token.x_center, boundaries), []).append(token)

    headers_by_column: dict[int, list[_Header]] = {}
    for header in headers:
        headers_by_column.setdefault(header.column, []).append(header)

    blocks: list[ParsedTeamBlock] = []
    for column, column_headers in headers_by_column.items():
        column_headers.sort(key=lambda h: h.label_token.y_center)
        column_tokens = by_column.get(column, [])
        for idx, header in enumerate(column_headers):
            y_start = header.label_token.y_center
            y_end = (
                column_headers[idx + 1].label_token.y_center
                if idx + 1 < len(column_headers)
                else float("inf")
            )
            block_tokens = [t for t in column_tokens if y_start < t.y_center < y_end]
            rows = _cluster_rows(block_tokens, ROW_Y_TOLERANCE_PX)
            rows.sort(key=lambda row: min(t.y_center for t in row))

            players = []
            for row in rows[:MAX_PLAYERS_PER_TEAM]:
                player = _row_to_player(row)
                if player is not None:
                    players.append(player)

            blocks.append(
                ParsedTeamBlock(rank=header.rank, ocr_label=header.label, players=players)
            )

    if not any(block.players for block in blocks):
        raise OcrParseError("Could not identify any player rows in screenshot")

    return blocks
