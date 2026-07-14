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
        # maybe_single() returns None outright (not a response with
        # .data=None) when zero rows match.
        # A re-opened existing match number keeps its original scoring mode —
        # match_type/label are only written on first creation.
        if existing and existing.data:
            return Match(**existing.data)
        row = {
            "tournament_id": str(tournament_id),
            "match_number": payload.match_number,
            "match_type": payload.match_type,
            "label": payload.label,
        }
        result = self.db.table(TABLE).insert(row).execute()
        return Match(**result.data[0])

    def get(self, match_id: UUID) -> Match | None:
        result = self.db.table(TABLE).select("*").eq("id", str(match_id)).maybe_single().execute()
        return Match(**result.data) if result and result.data else None

    def list_for_tournament(self, tournament_id: UUID) -> list[Match]:
        result = (
            self.db.table(TABLE)
            .select("*")
            .eq("tournament_id", str(tournament_id))
            .order("match_number")
            .execute()
        )
        return [Match(**row) for row in result.data]

    def list_confirmed_results(self, match_id: UUID) -> list[dict]:
        result = (
            self.db.table("match_results")
            .select("team_id, placement, team_kills, teams(name)")
            .eq("match_id", str(match_id))
            .eq("confirmed", True)
            .order("placement")
            .execute()
        )
        return [
            {
                "team_id": row["team_id"],
                "team_name": row["teams"]["name"],
                "placement": row["placement"],
                "team_kills": row["team_kills"],
            }
            for row in result.data
        ]
