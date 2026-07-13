import hashlib
from uuid import UUID, uuid4

from supabase import Client

from app.core.config import get_settings
from app.core.logging import get_logger
from app.models.schemas import OcrReviewPayload, OcrStatus
from app.repositories.player_repository import PlayerRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.team_repository import TeamRepository
from app.services.ocr_service import OcrService

logger = get_logger(__name__)


class DuplicateUploadError(Exception):
    pass


class UploadService:
    def __init__(
        self,
        db: Client,
        screenshot_repo: ScreenshotRepository,
        player_repo: PlayerRepository,
        team_repo: TeamRepository,
        ocr_service: OcrService | None = None,
    ):
        self.db = db
        self.screenshot_repo = screenshot_repo
        self.player_repo = player_repo
        self.team_repo = team_repo
        self.ocr_service = ocr_service or OcrService()
        self.bucket = get_settings().supabase_storage_bucket

    def accept_upload(self, match_id: UUID, filename: str, content: bytes) -> dict:
        content_hash = hashlib.sha256(content).hexdigest()
        if self.screenshot_repo.find_duplicate(match_id, content_hash):
            raise DuplicateUploadError(
                "This screenshot has already been uploaded for this match."
            )

        storage_path = f"{match_id}/{uuid4()}-{filename}"
        self.db.storage.from_(self.bucket).upload(
            storage_path, content, {"content-type": "image/*"}
        )
        return self.screenshot_repo.create(match_id, storage_path, content_hash)

    def run_ocr_pipeline(self, screenshot_id: UUID, tournament_id: UUID) -> None:
        """Runs OCR + fuzzy matching for a screenshot. Intended to run as a
        FastAPI background task so the upload request returns immediately.

        Matches against every player discovered so far in the tournament
        (not one pre-picked team's roster) and infers a team suggestion from
        which existing team the matched players belong to.
        """
        try:
            self.screenshot_repo.update_status(screenshot_id, OcrStatus.OCR)
            screenshot = self.screenshot_repo.get(screenshot_id)
            if screenshot is None:
                logger.error("Screenshot %s vanished before OCR could run", screenshot_id)
                return

            image_bytes = self.db.storage.from_(self.bucket).download(screenshot["storage_path"])
            roster = self.player_repo.list_for_tournament(tournament_id)
            teams = self.team_repo.list_for_tournament(tournament_id)

            payload: OcrReviewPayload = self.ocr_service.process_screenshot(
                image_bytes, screenshot_id, roster, teams
            )

            if payload.error_message:
                self.screenshot_repo.update_status(
                    screenshot_id, OcrStatus.FAILED, error_message=payload.error_message
                )
                return

            self.screenshot_repo.update_status(
                screenshot_id, OcrStatus.OCR, raw_ocr_json=payload.model_dump(mode="json")
            )
        except Exception:
            logger.exception("OCR pipeline crashed for screenshot %s", screenshot_id)
            self.screenshot_repo.update_status(
                screenshot_id,
                OcrStatus.FAILED,
                error_message="Something went wrong processing this screenshot. Please try again.",
            )
