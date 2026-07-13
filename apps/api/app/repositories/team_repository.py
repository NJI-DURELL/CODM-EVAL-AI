from uuid import UUID

from supabase import Client

from app.models.schemas import Team, TeamCreate

TABLE = "teams"


class TeamRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, tournament_id: UUID, payload: TeamCreate) -> Team:
        row = {"tournament_id": str(tournament_id), "name": payload.name}
        result = self.db.table(TABLE).insert(row).execute()
        return Team(**result.data[0])

    def list_for_tournament(self, tournament_id: UUID) -> list[Team]:
        result = (
            self.db.table(TABLE)
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .order("name")
            .execute()
        )
        return [Team(**row) for row in result.data]

    def get(self, team_id: UUID) -> Team | None:
        # maybe_single() returns None outright (not a response with
        # .data=None) when zero rows match.
        result = self.db.table(TABLE).select("*").eq("id", str(team_id)).maybe_single().execute()
        return Team(**result.data) if result and result.data else None
