from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, status

from app.api.deps import (
    Db,
    get_match_repo,
    get_player_repo,
    get_screenshot_repo,
    get_team_repo,
    require_tournament_owner,
)
from app.models.schemas import (
    MatchResultConfirm,
    OcrReviewPayload,
    OcrStatus,
    PlayerCreate,
    ScreenshotSummary,
    ScreenshotUploadResult,
    TeamCreate,
)
from app.repositories.match_repository import MatchRepository
from app.repositories.player_repository import PlayerRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.team_repository import TeamRepository
from app.services.upload_service import (
    DuplicateUploadError,
    UnsupportedFileTypeError,
    UploadService,
)

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


@router.post("/screenshots", response_model=ScreenshotUploadResult, status_code=201)
async def upload_screenshot(
    tournament_id: UUID,
    match_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    db: Db,
    screenshot_repo: Annotated[ScreenshotRepository, Depends(get_screenshot_repo)],
    player_repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    team_repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _match=Depends(_require_match),
) -> ScreenshotUploadResult:
    content = await file.read()
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty")

    service = UploadService(db, screenshot_repo, player_repo, team_repo)
    try:
        screenshot = service.accept_upload(
            match_id,
            file.filename or "screenshot",
            content,
            file.content_type or "application/octet-stream",
        )
    except DuplicateUploadError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except UnsupportedFileTypeError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc

    background_tasks.add_task(service.run_ocr_pipeline, screenshot["id"], tournament_id)
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
    tournament_id: UUID,
    screenshot_id: UUID,
    match_id: UUID,
    payload: MatchResultConfirm,
    screenshot_repo: Annotated[ScreenshotRepository, Depends(get_screenshot_repo)],
    team_repo: Annotated[TeamRepository, Depends(get_team_repo)],
    player_repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _match=Depends(_require_match),
) -> None:
    screenshot = screenshot_repo.get(screenshot_id)
    if screenshot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Screenshot not found")

    team = None
    if payload.team_id is not None:
        team = team_repo.get(payload.team_id)
        if team is None or team.tournament_id != tournament_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found in this tournament")
    else:
        if not payload.team_name or not payload.team_name.strip():
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Name the team before confirming a new one."
            )
        team = team_repo.create(tournament_id, TeamCreate(name=payload.team_name.strip()))

    # No pre-registered roster to match against, so a name OCR couldn't (or
    # organizer didn't) match to an existing player is a genuinely new
    # player, created here rather than dropped from individual stats. Any
    # near-duplicate from an OCR misread gets reconciled by the organizer
    # later, same as team names.
    resolved_players = []
    for entry in payload.players:
        if entry.player_id is None and (entry.matched_name or entry.ocr_name).strip():
            new_player = player_repo.create(
                team.id, PlayerCreate(name=(entry.matched_name or entry.ocr_name).strip())
            )
            entry = entry.model_copy(update={"player_id": new_player.id})
        resolved_players.append(entry)

    screenshot_repo.update_status(screenshot_id, OcrStatus.CALCULATING)
    screenshot_repo.confirm_match_result(
        screenshot_id=screenshot_id,
        match_id=match_id,
        team_id=team.id,
        placement=payload.placement,
        players=resolved_players,
    )
