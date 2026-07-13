from uuid import UUID

from supabase import Client

from app.models.schemas import Team, TeamCreate

TABLE = "teams"
MAX_TEAMS_PER_CLAN = 5


class TeamLimitExceededError(Exception):
    pass


class TeamRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, clan_id: UUID, payload: TeamCreate) -> Team:
        existing = self.count_for_clan(clan_id)
        if existing >= MAX_TEAMS_PER_CLAN:
            raise TeamLimitExceededError(
                f"Clan already has {MAX_TEAMS_PER_CLAN} registered teams (the maximum)."
            )
        row = {"clan_id": str(clan_id), "name": payload.name}
        result = self.db.table(TABLE).insert(row).execute()
        return Team(**result.data[0])

    def count_for_clan(self, clan_id: UUID) -> int:
        result = self.db.table(TABLE).select("id", count="exact").eq("clan_id", str(clan_id)).execute()
        return result.count or 0

    def list_for_clan(self, clan_id: UUID) -> list[Team]:
        result = self.db.table(TABLE).select("*").eq("clan_id", str(clan_id)).order("name").execute()
        return [Team(**row) for row in result.data]

    def get(self, team_id: UUID) -> Team | None:
        result = self.db.table(TABLE).select("*").eq("id", str(team_id)).maybe_single().execute()
        return Team(**result.data) if result.data else None

    def get_with_clan(self, team_id: UUID) -> dict | None:
        result = (
            self.db.table(TABLE)
            .select("*, clans!inner(tournament_id)")
            .eq("id", str(team_id))
            .maybe_single()
            .execute()
        )
        return result.data
