from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_clan_repo, get_team_repo, require_tournament_owner
from app.models.schemas import Team, TeamCreate
from app.repositories.clan_repository import ClanRepository
from app.repositories.team_repository import TeamLimitExceededError, TeamRepository

router = APIRouter(prefix="/tournaments/{tournament_id}/clans/{clan_id}/teams", tags=["teams"])


def _require_clan_in_tournament(
    tournament_id: UUID,
    clan_id: UUID,
    clan_repo: Annotated[ClanRepository, Depends(get_clan_repo)],
    _owner=Depends(require_tournament_owner),
):
    clan = clan_repo.get(clan_id)
    if clan is None or clan.tournament_id != tournament_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Clan not found in this tournament")
    return clan


@router.post("", response_model=Team, status_code=201)
def create_team(
    clan_id: UUID,
    payload: TeamCreate,
    repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _clan=Depends(_require_clan_in_tournament),
) -> Team:
    try:
        return repo.create(clan_id, payload)
    except TeamLimitExceededError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("", response_model=list[Team])
def list_teams(
    clan_id: UUID,
    repo: Annotated[TeamRepository, Depends(get_team_repo)],
    _clan=Depends(_require_clan_in_tournament),
) -> list[Team]:
    return repo.list_for_clan(clan_id)
