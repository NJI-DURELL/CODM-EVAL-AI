from uuid import UUID

from supabase import Client

from app.models.schemas import Player, PlayerCreate

TABLE = "players"


class PlayerRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, team_id: UUID, payload: PlayerCreate) -> Player:
        row = {"team_id": str(team_id), "name": payload.name, "ign": payload.ign}
        result = self.db.table(TABLE).insert(row).execute()
        return Player(**result.data[0])

    def list_for_team(self, team_id: UUID) -> list[Player]:
        result = self.db.table(TABLE).select("*").eq("team_id", str(team_id)).order("name").execute()
        return [Player(**row) for row in result.data]

    def list_for_tournament(self, tournament_id: UUID) -> list[Player]:
        result = (
            self.db.table(TABLE)
            .select("*, teams!inner(clan_id, clans!inner(tournament_id))")
            .eq("teams.clans.tournament_id", str(tournament_id))
            .execute()
        )
        return [Player(**{k: v for k, v in row.items() if k != "teams"}) for row in result.data]
