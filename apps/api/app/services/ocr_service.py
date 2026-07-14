import io
from collections import Counter
from uuid import UUID

from PIL import Image, UnidentifiedImageError

from app.core.logging import get_logger
from app.models.schemas import OcrReviewPayload, OcrTeamResult, Player, PlayerKillEntry, Team
from app.ocr.codm_parser import OcrParseError, ParsedTeamBlock, parse_scoreboard
from app.ocr.paddle_engine import run_ocr
from app.services.matching_service import MatchingService

logger = get_logger(__name__)


class OcrService:
    def __init__(self, matching_service: MatchingService | None = None):
        self.matching_service = matching_service or MatchingService()

    def process_screenshot(
        self,
        image_bytes: bytes,
        screenshot_id,
        roster: list[Player],
        teams: list[Team],
    ) -> OcrReviewPayload:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.load()
        except (UnidentifiedImageError, OSError) as exc:
            logger.warning("Unreadable screenshot %s: %s", screenshot_id, exc)
            return OcrReviewPayload(
                screenshot_id=screenshot_id,
                teams=[],
                needs_review=True,
                error_message=(
                    "This file could not be read as an image. "
                    "Please re-upload a clear screenshot."
                ),
            )

        try:
            tokens = run_ocr(image)
            blocks = parse_scoreboard(tokens)
        except OcrParseError as exc:
            logger.info("OCR parse failure for %s: %s", screenshot_id, exc)
            return OcrReviewPayload(
                screenshot_id=screenshot_id,
                teams=[],
                needs_review=True,
                error_message=(
                    f"Couldn't read the scoreboard clearly ({exc}). Please review manually."
                ),
            )
        except Exception:
            logger.exception("Unexpected OCR failure for screenshot %s", screenshot_id)
            return OcrReviewPayload(
                screenshot_id=screenshot_id,
                teams=[],
                needs_review=True,
                error_message=(
                    "OCR processing failed unexpectedly. "
                    "Please try again or enter results manually."
                ),
            )

        player_team_by_id = {p.id: p.team_id for p in roster}
        team_name_by_id = {t.id: t.name for t in teams}

        team_results = [
            self._match_block(block, roster, player_team_by_id, team_name_by_id) for block in blocks
        ]

        return OcrReviewPayload(
            screenshot_id=screenshot_id,
            teams=team_results,
            needs_review=any(t.needs_review for t in team_results),
        )

    def _match_block(
        self,
        block: ParsedTeamBlock,
        roster: list[Player],
        player_team_by_id: dict[UUID, UUID],
        team_name_by_id: dict[UUID, str],
    ) -> OcrTeamResult:
        entries: list[PlayerKillEntry] = []
        matched_team_ids: list[UUID] = []
        needs_review = block.rank is None
        for row in block.players:
            candidate = self.matching_service.match(row.ocr_name, roster)
            if candidate.needs_review:
                needs_review = True
            if candidate.player_id is not None:
                matched_team_ids.append(player_team_by_id[candidate.player_id])
            entries.append(
                PlayerKillEntry(
                    player_id=candidate.player_id,
                    ocr_name=row.ocr_name,
                    matched_name=candidate.matched_name,
                    match_confidence=candidate.confidence,
                    kills=row.kills,
                )
            )

        # Team identity is inferred from player continuity rather than OCR'd
        # text (CODM result screens print a generic "TEAMn" slot label, not
        # a stable clan/team name — see ocr_label): if a majority of matched
        # players already belong to the same team, that team is the
        # suggestion; otherwise this reads as a new team and the organizer
        # names it once during review.
        suggested_team_id = None
        suggested_team_name = None
        if matched_team_ids:
            team_id, count = Counter(matched_team_ids).most_common(1)[0]
            if count > len(matched_team_ids) / 2:
                suggested_team_id = team_id
                suggested_team_name = team_name_by_id.get(team_id)

        return OcrTeamResult(
            ocr_label=block.ocr_label,
            placement=block.rank,
            team_kills=sum(e.kills for e in entries),
            players=entries,
            needs_review=needs_review,
            suggested_team_id=suggested_team_id,
            suggested_team_name=suggested_team_name,
        )
