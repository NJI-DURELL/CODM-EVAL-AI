from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from supabase import Client

from app.core.auth import get_current_organizer_id
from app.core.supabase_client import get_supabase
from app.repositories.leaderboard_repository import LeaderboardRepository
from app.repositories.match_repository import MatchRepository
from app.repositories.player_repository import PlayerRepository
from app.repositories.screenshot_repository import ScreenshotRepository
from app.repositories.team_repository import TeamRepository
from app.repositories.tournament_repository import TournamentRepository

OrganizerId = Annotated[str, Depends(get_current_organizer_id)]
Db = Annotated[Client, Depends(get_supabase)]


def get_tournament_repo(db: Db) -> TournamentRepository:
    return TournamentRepository(db)


def get_team_repo(db: Db) -> TeamRepository:
    return TeamRepository(db)


def get_player_repo(db: Db) -> PlayerRepository:
    return PlayerRepository(db)


def get_match_repo(db: Db) -> MatchRepository:
    return MatchRepository(db)


def get_screenshot_repo(db: Db) -> ScreenshotRepository:
    return ScreenshotRepository(db)


def get_leaderboard_repo(db: Db) -> LeaderboardRepository:
    return LeaderboardRepository(db)


def require_tournament_owner(
    tournament_id: UUID,
    organizer_id: OrganizerId,
    tournament_repo: Annotated[TournamentRepository, Depends(get_tournament_repo)],
):
    tournament = tournament_repo.get(organizer_id, tournament_id)
    if tournament is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Tournament not found")
    return tournament
