from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status

from app.api.deps import (
    Db,
    get_match_repo,
    get_player_repo,
    get_screenshot_repo,
    require_tournament_owner,
)
from app.models.schemas import (
    MatchResultConfirm,
    OcrReviewPayload,
    OcrStatus,
    ScreenshotSummary,
    ScreenshotUploadResult,
)
from app.repositories.match_repository import MatchRepository
from app.repositories.player_repository import PlayerRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.services.upload_service import DuplicateUploadError, UploadService

router = APIRouter(prefix="/tournaments/{tournament_id}/matches/{match_id}", tags=["uploads"])


def _require_match(
    tournament_id: UUID,
    match_id: UUID,
    match_repo: Annotated[MatchRepository, Depends(get_match_repo)],
    _owner=Depends(require_tournament_owner),
):
    match = match_repo.get(match_id)
    if match is None or match.tournament_id != tournament_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found in this tournament")
    return match


@router.post("/teams/{team_id}/screenshots", response_model=ScreenshotUploadResult, status_code=201)
async def upload_screenshot(
    match_id: UUID,
    team_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: Db,
    screenshot_repo: Annotated[ScreenshotRepository, Depends(get_screenshot_repo)],
    player_repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _match=Depends(_require_match),
) -> ScreenshotUploadResult:
    content = await file.read()
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty")

    service = UploadService(db, screenshot_repo, player_repo)
    try:
        screenshot = service.accept_upload(
            match_id, team_id, file.filename or "screenshot", content
        )
    except DuplicateUploadError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc

    background_tasks.add_task(service.run_ocr_pipeline, screenshot["id"], team_id)
    return ScreenshotUploadResult(**screenshot)


@router.get("/screenshots", response_model=list[ScreenshotSummary])
def list_screenshots(
    screenshot_repo: Annotated[ScreenshotRepository, Depends(get_screenshot_repo)],
    match=Depends(_require_match),
) -> list[ScreenshotSummary]:
    return [ScreenshotSummary(**row) for row in screenshot_repo.list_for_match(match.id)]


@router.get("/screenshots/{screenshot_id}", response_model=OcrReviewPayload)
def get_screenshot_status(
    screenshot_id: UUID,
    screenshot_repo: Annotated[ScreenshotRepository, Depends(get_screenshot_repo)],
    _match=Depends(_require_match),
) -> OcrReviewPayload:
    screenshot = screenshot_repo.get(screenshot_id)
    if screenshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Screenshot not found")

    if screenshot["ocr_status"] == OcrStatus.FAILED:
        return OcrReviewPayload(
            screenshot_id=screenshot_id,
            placement=None,
            team_kills=None,
            players=[],
            needs_review=True,
            error_message=screenshot.get("error_message") or "Processing failed.",
        )

    if not screenshot.get("raw_ocr_json"):
        # Still uploading/OCR-ing — frontend should keep polling.
        return OcrReviewPayload(
            screenshot_id=screenshot_id,
            placement=None,
            team_kills=None,
            players=[],
            needs_review=False,
        )

    return OcrReviewPayload(**screenshot["raw_ocr_json"])


@router.post("/screenshots/{screenshot_id}/confirm", status_code=204)
def confirm_screenshot(
    screenshot_id: UUID,
    match_id: UUID,
    payload: MatchResultConfirm,
    screenshot_repo: Annotated[ScreenshotRepository, Depends(get_screenshot_repo)],
    _match=Depends(_require_match),
) -> None:
    screenshot = screenshot_repo.get(screenshot_id)
    if screenshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Screenshot not found")

    screenshot_repo.update_status(screenshot_id, OcrStatus.CALCULATING)
    screenshot_repo.confirm_match_result(
        screenshot_id=screenshot_id,
        match_id=match_id,
        team_id=UUID(screenshot["team_id"]),
        placement=payload.placement,
        players=payload.players,
    )
