from uuid import UUID

from supabase import Client

from app.models.schemas import Match, MatchCreate

TABLE = "matches"


class MatchRepository:
    def __init__(self, db: Client):
        self.db = db

    def get_or_create(self, tournament_id: UUID, payload: MatchCreate) -> Match:
        existing = (
            self.db.table(TABLE)
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .eq("match_number", payload.match_number)
            .maybe_single()
            .execute()
        )
        if existing.data:
            return Match(**existing.data)
        row = {"tournament_id": str(tournament_id), "match_number": payload.match_number}
        result = self.db.table(TABLE).insert(row).execute()
        return Match(**result.data[0])

    def get(self, match_id: UUID) -> Match | None:
        result = self.db.table(TABLE).select("*").eq("id", str(match_id)).maybe_single().execute()
        return Match(**result.data) if result.data else None

    def list_for_tournament(self, tournament_id: UUID) -> list[Match]:
        result = (
            self.db.table(TABLE)
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .order("match_number")
            .execute()
        )
        return [Match(**row) for row in result.data]
