from uuid import UUID

from supabase import Client

from app.core.config import DEFAULT_KILL_POINT_VALUE, DEFAULT_PLACEMENT_POINTS
from app.models.schemas import Tournament, TournamentCreate

TABLE = "tournaments"


class TournamentRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, organizer_id: str, payload: TournamentCreate) -> Tournament:
        row = {
            "organizer_id": organizer_id,
            "name": payload.name,
            "logo_url": payload.logo_url,
            "event_date": payload.event_date.isoformat() if payload.event_date else None,
            "placement_points": payload.placement_points or DEFAULT_PLACEMENT_POINTS,
            "kill_point_value": payload.kill_point_value or DEFAULT_KILL_POINT_VALUE,
            "status": "active",
        }
        result = self.db.table(TABLE).insert(row).execute()
        return Tournament(**result.data[0])

    def list_for_organizer(self, organizer_id: str) -> list[Tournament]:
        result = (
            self.db.table(TABLE)
            .select("*")
            .eq("organizer_id", organizer_id)
            .order("created_at", desc=True)
            .execute()
        )
        return [Tournament(**row) for row in result.data]

    def get(self, organizer_id: str, tournament_id: UUID) -> Tournament | None:
        result = (
            self.db.table(TABLE)
            .select("*")
            .eq("organizer_id", organizer_id)
            .eq("id", str(tournament_id))
            .maybe_single()
            .execute()
        )
        return Tournament(**result.data) if result.data else None
