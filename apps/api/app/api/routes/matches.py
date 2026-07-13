from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import get_match_repo, require_tournament_owner
from app.models.schemas import Match, MatchCreate
from app.repositories.match_repository import MatchRepository

router = APIRouter(prefix="/tournaments/{tournament_id}/matches", tags=["matches"])


@router.post("", response_model=Match, status_code=201)
def create_or_get_match(
    tournament_id: UUID,
    payload: MatchCreate,
    repo: Annotated[MatchRepository, Depends(get_match_repo)],
    _owner=Depends(require_tournament_owner),
) -> Match:
    return repo.get_or_create(tournament_id, payload)


@router.get("", response_model=list[Match])
def list_matches(
    tournament_id: UUID,
    repo: Annotated[MatchRepository, Depends(get_match_repo)],
    _owner=Depends(require_tournament_owner),
) -> list[Match]:
    return repo.list_for_tournament(tournament_id)
