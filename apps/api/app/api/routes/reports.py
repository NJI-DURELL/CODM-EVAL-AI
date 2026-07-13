from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response

from app.api.deps import (
    get_leaderboard_repo,
    get_match_repo,
    get_player_repo,
    get_team_repo,
    require_tournament_owner,
)
from app.models.schemas import Tournament
from app.repositories.leaderboard_repository import LeaderboardRepository
from app.repositories.match_repository import MatchRepository
from app.repositories.player_repository import PlayerRepository
from app.repositories.team_repository import TeamRepository
from app.services.pdf_report_service import PdfReportService

router = APIRouter(prefix="/tournaments/{tournament_id}/reports", tags=["reports"])


@router.get("/pdf")
def download_pdf_report(
    tournament_id: UUID,
    leaderboard_repo: Annotated[LeaderboardRepository, Depends(get_leaderboard_repo)],
    team_repo: Annotated[TeamRepository, Depends(get_team_repo)],
    player_repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    match_repo: Annotated[MatchRepository, Depends(get_match_repo)],
    tournament: Annotated[Tournament, Depends(require_tournament_owner)],
) -> Response:
    service = PdfReportService(leaderboard_repo, team_repo, player_repo, match_repo)
    pdf_bytes = service.generate(tournament)
    filename = f"{tournament.name.replace(' ', '_')}_report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
