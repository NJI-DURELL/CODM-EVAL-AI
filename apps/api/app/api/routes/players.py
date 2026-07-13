from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_player_repo, require_tournament_owner
from app.api.routes.teams import _require_team_in_tournament
from app.models.schemas import Player, PlayerCreate
from app.repositories.player_repository import PlayerRepository

router = APIRouter(prefix="/tournaments/{tournament_id}/teams/{team_id}/players", tags=["players"])

tournament_players_router = APIRouter(
    prefix="/tournaments/{tournament_id}/players", tags=["players"]
)


@tournament_players_router.get("", response_model=list[Player])
def list_tournament_players(
    tournament_id: UUID,
    repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _owner=Depends(require_tournament_owner),
) -> list[Player]:
    """Every player discovered so far in the tournament, across all teams —
    used by the review panel's player picker (there's no fixed per-team
    roster to scope to anymore)."""
    return repo.list_for_tournament(tournament_id)


@router.post("", response_model=Player, status_code=201)
def create_player(
    team_id: UUID,
    payload: PlayerCreate,
    repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _team=Depends(_require_team_in_tournament),
) -> Player:
    return repo.create(team_id, payload)


@router.get("", response_model=list[Player])
def list_players(
    team_id: UUID,
    repo: Annotated[PlayerRepository, Depends(get_player_repo)],
    _team=Depends(_require_team_in_tournament),
) -> list[Player]:
    return repo.list_for_team(team_id)
