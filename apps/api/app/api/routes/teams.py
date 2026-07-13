from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_team_repo, require_tournament_owner
from app.models.schemas import Team, TeamCreate
from app.repositories.team_repository import TeamRepository

router = APIRouter(prefix="/tournaments/{tournament_id}/teams", tags=["teams"])


def _require_team_in_tournament(
    tournament_id: UUID,
    team_id: UUID,
    team_repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _owner=Depends(require_tournament_owner),
):
    team = team_repo.get(team_id)
    if team is None or team.tournament_id != tournament_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found in this tournament")
    return team


@router.post("", response_model=Team, status_code=201)
def create_team(
    tournament_id: UUID,
    payload: TeamCreate,
    repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _owner=Depends(require_tournament_owner),
) -> Team:
    return repo.create(tournament_id, payload)


@router.get("", response_model=list[Team])
def list_teams(
    tournament_id: UUID,
    repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _owner=Depends(require_tournament_owner),
) -> list[Team]:
    return repo.list_for_tournament(tournament_id)
