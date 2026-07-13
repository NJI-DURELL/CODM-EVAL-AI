from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import OrganizerId, get_tournament_repo, require_tournament_owner
from app.models.schemas import Tournament, TournamentCreate
from app.repositories.tournament_repository import TournamentRepository

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


@router.post("", response_model=Tournament, status_code=201)
def create_tournament(
    payload: TournamentCreate,
    organizer_id: OrganizerId,
    repo: Annotated[TournamentRepository, Depends(get_tournament_repo)],
) -> Tournament:
    return repo.create(organizer_id, payload)


@router.get("", response_model=list[Tournament])
def list_tournaments(
    organizer_id: OrganizerId,
    repo: Annotated[TournamentRepository, Depends(get_tournament_repo)],
) -> list[Tournament]:
    return repo.list_for_organizer(organizer_id)


@router.get("/{tournament_id}", response_model=Tournament)
def get_tournament(
    tournament: Annotated[Tournament, Depends(require_tournament_owner)],
) -> Tournament:
    return tournament
