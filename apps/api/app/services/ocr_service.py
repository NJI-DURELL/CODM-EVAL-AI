import io

from PIL import Image, UnidentifiedImageError

from app.core.logging import get_logger
from app.models.schemas import OcrReviewPayload, Player, PlayerKillEntry
from app.ocr.codm_parser import OcrParseError, parse_scoreboard
from app.ocr.paddle_engine import run_ocr
from app.services.matching_service import MatchingService

logger = get_logger(__name__)


class OcrService:
    def __init__(self, matching_service: MatchingService | None = None):
        self.matching_service = matching_service or MatchingService()

    def process_screenshot(
        self, image_bytes: bytes, screenshot_id, roster: list[Player]
    ) -> OcrReviewPayload:
        try:
            image = Image.open(io.BytesIO(image_bytes))
            image.load()
        except (UnidentifiedImageError, OSError) as exc:
            logger.warning("Unreadable screenshot %s: %s", screenshot_id, exc)
            return OcrReviewPayload(
                screenshot_id=screenshot_id,
                placement=None,
                team_kills=None,
                players=[],
                needs_review=True,
                error_message=(
                    "This file could not be read as an image. "
                    "Please re-upload a clear screenshot."
                ),
            )

        try:
            tokens = run_ocr(image)
            scoreboard = parse_scoreboard(tokens)
        except OcrParseError as exc:
            logger.info("OCR parse failure for %s: %s", screenshot_id, exc)
            return OcrReviewPayload(
                screenshot_id=screenshot_id,
                placement=None,
                team_kills=None,
                players=[],
                needs_review=True,
                error_message=(
                    f"Couldn't read the scoreboard clearly ({exc}). Please review manually."
                ),
            )
        except Exception:
            logger.exception("Unexpected OCR failure for screenshot %s", screenshot_id)
            return OcrReviewPayload(
                screenshot_id=screenshot_id,
                placement=None,
                team_kills=None,
                players=[],
                needs_review=True,
                error_message=(
                    "OCR processing failed unexpectedly. "
                    "Please try again or enter results manually."
                ),
            )

        entries: list[PlayerKillEntry] = []
        needs_review = scoreboard.placement is None
        for row in scoreboard.players:
            candidate = self.matching_service.match(row.ocr_name, roster)
            if candidate.needs_review:
                needs_review = True
            entries.append(
                PlayerKillEntry(
                    player_id=candidate.player_id,
                    ocr_name=row.ocr_name,
                    matched_name=candidate.matched_name,
                    match_confidence=candidate.confidence,
                    kills=row.kills,
                )
            )

        return OcrReviewPayload(
            screenshot_id=screenshot_id,
            placement=scoreboard.placement,
            team_kills=sum(e.kills for e in entries),
            players=entries,
            needs_review=needs_review,
        )
