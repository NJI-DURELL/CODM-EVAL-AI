from uuid import UUID

from supabase import Client

from app.models.schemas import Clan, ClanCreate

TABLE = "clans"


class ClanRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, tournament_id: UUID, payload: ClanCreate) -> Clan:
        row = {
            "tournament_id": str(tournament_id),
            "name": payload.name,
            "logo_url": payload.logo_url,
        }
        result = self.db.table(TABLE).insert(row).execute()
        return Clan(**result.data[0])

    def list_for_tournament(self, tournament_id: UUID) -> list[Clan]:
        result = (
            self.db.table(TABLE)
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .order("name")
            .execute()
        )
        return [Clan(**row) for row in result.data]

    def get(self, clan_id: UUID) -> Clan | None:
        # maybe_single() returns None outright (not a response with .data=None)
        # when zero rows match.
        result = self.db.table(TABLE).select("*").eq("id", str(clan_id)).maybe_single().execute()
        return Clan(**result.data) if result and result.data else None
