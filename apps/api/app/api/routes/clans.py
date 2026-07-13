from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_clan_repo, require_tournament_owner
from app.models.schemas import Clan, ClanCreate
from app.repositories.clan_repository import ClanRepository

router = APIRouter(prefix="/tournaments/{tournament_id}/clans", tags=["clans"])


@router.post("", response_model=Clan, status_code=201)
def create_clan(
    tournament_id: UUID,
    payload: ClanCreate,
    repo: Annotated[ClanRepository, Depends(get_clan_repo)],
    _owner=Depends(require_tournament_owner),
) -> Clan:
    return repo.create(tournament_id, payload)


@router.get("", response_model=list[Clan])
def list_clans(
    tournament_id: UUID,
    repo: Annotated[ClanRepository, Depends(get_clan_repo)],
    _owner=Depends(require_tournament_owner),
) -> list[Clan]:
    return repo.list_for_tournament(tournament_id)
