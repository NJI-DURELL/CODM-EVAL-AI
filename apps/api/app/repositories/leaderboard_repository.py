from uuid import UUID

from supabase import Client

from app.models.schemas import PlayerLeaderboardRow, TeamLeaderboardRow


class LeaderboardRepository:
    """Reads the pre-aggregated SQL views (see supabase/migrations) so
    standings are always computed fresh from `match_results` /
    `player_match_stats` rather than duplicated in application state.
    """

    def __init__(self, db: Client):
        self.db = db

    def team_leaderboard(self, tournament_id: UUID) -> list[TeamLeaderboardRow]:
        result = (
            self.db.table("team_leaderboard_view")
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .order("total_points", desc=True)
            .execute()
        )
        return [TeamLeaderboardRow(**row) for row in result.data]

    def player_leaderboard(self, tournament_id: UUID) -> list[PlayerLeaderboardRow]:
        result = (
            self.db.table("player_leaderboard_view")
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .order("total_kills", desc=True)
            .execute()
        )
        return [PlayerLeaderboardRow(**row) for row in result.data]
