from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_player_repo, get_team_repo
from app.api.routes.teams import _require_clan_in_tournament
from app.models.schemas import Player, PlayerCreate
from app.repositories.player_repository import PlayerRepository
from app.repositories.team_repository import TeamRepository

router = APIRouter(
    prefix="/tournaments/{tournament_id}/clans/{clan_id}/teams/{team_id}/players", tags=["players"]
)


def _require_team_in_clan(
    clan_id: UUID,
    team_id: UUID,
    team_repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _clan=Depends(_require_clan_in_tournament),
):
    team = team_repo.get(team_id)
    if team is None or team.clan_id != clan_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Team not found in this clan")
    return team


@router.post("", response_model=Player, status_code=201)
def create_player(
    team_id: UUID,
    payload: PlayerCreate,
    repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _team=Depends(_require_team_in_clan),
) -> Player:
    return repo.create(team_id, payload)


@router.get("", response_model=list[Player])
def list_players(
    team_id: UUID,
    repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _team=Depends(_require_team_in_clan),
) -> list[Player]:
    return repo.list_for_team(team_id)
