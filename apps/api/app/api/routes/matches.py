from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_match_repo, require_tournament_owner
from app.models.schemas import Match, MatchCreate, MatchResultSummary, Tournament
from app.repositories.match_repository import MatchRepository
from app.scoring.scoring_service import performance_review, split_match_points

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


@router.get("/{match_id}/results", response_model=list[MatchResultSummary])
def get_match_results(
    tournament_id: UUID,
    match_id: UUID,
    repo: Annotated[MatchRepository, Depends(get_match_repo)],
    tournament: Annotated[Tournament, Depends(require_tournament_owner)],
) -> list[MatchResultSummary]:
    match = repo.get(match_id)
    if match is None or match.tournament_id != tournament_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Match not found in this tournament")

    summaries = []
    for row in repo.list_confirmed_results(match_id):
        placement_pts, kill_pts = split_match_points(
            match.match_type,
            row["placement"],
            row["team_kills"],
            tournament.placement_points,
            tournament.kill_point_value,
        )
        summaries.append(
            MatchResultSummary(
                team_id=row["team_id"],
                team_name=row["team_name"],
                placement=row["placement"],
                team_kills=row["team_kills"],
                placement_points=placement_pts,
                kill_points=kill_pts,
                total_points=placement_pts + kill_pts,
                performance_review=performance_review(
                    match.match_type,
                    row["placement"],
                    row["team_kills"],
                    placement_pts,
                    kill_pts,
                ),
            )
        )
    return summaries
