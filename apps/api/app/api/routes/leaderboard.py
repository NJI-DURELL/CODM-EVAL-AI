from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_leaderboard_repo, require_tournament_owner
from app.models.schemas import Awards, PlayerLeaderboardRow, TeamLeaderboardRow
from app.repositories.leaderboard_repository import LeaderboardRepository
from app.scoring.scoring_service import compute_awards

router = APIRouter(prefix="/tournaments/{tournament_id}/leaderboard", tags=["leaderboard"])


@router.get("/teams", response_model=list[TeamLeaderboardRow])
def team_leaderboard(
    tournament_id: UUID,
    repo: Annotated[LeaderboardRepository, Depends(get_leaderboard_repo)],
    _owner=Depends(require_tournament_owner),
) -> list[TeamLeaderboardRow]:
    return repo.team_leaderboard(tournament_id)


@router.get("/players", response_model=list[PlayerLeaderboardRow])
def player_leaderboard(
    tournament_id: UUID,
    repo: Annotated[LeaderboardRepository, Depends(get_leaderboard_repo)],
    _owner=Depends(require_tournament_owner),
) -> list[PlayerLeaderboardRow]:
    return repo.player_leaderboard(tournament_id)


@router.get("/awards", response_model=Awards)
def awards(
    tournament_id: UUID,
    repo: Annotated[LeaderboardRepository, Depends(get_leaderboard_repo)],
    _owner=Depends(require_tournament_owner),
) -> Awards:
    return compute_awards(
        repo.team_leaderboard(tournament_id), repo.player_leaderboard(tournament_id)
    )
