from uuid import UUID

from supabase import Client

from app.models.schemas import OcrStatus, PlayerKillEntry

SCREENSHOTS = "screenshots"
MATCH_RESULTS = "match_results"
PLAYER_MATCH_STATS = "player_match_stats"


class ScreenshotRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, match_id: UUID, team_id: UUID, storage_path: str, content_hash: str) -> dict:
        row = {
            "match_id": str(match_id),
            "team_id": str(team_id),
            "storage_path": storage_path,
            "content_hash": content_hash,
            "ocr_status": OcrStatus.UPLOADING,
        }
        result = self.db.table(SCREENSHOTS).insert(row).execute()
        return result.data[0]

    def list_for_match(self, match_id: UUID) -> list[dict]:
        result = (
            self.db.table(SCREENSHOTS)
            .select("id, match_id, team_id, ocr_status, error_message, created_at")
            .eq("match_id", str(match_id))
            .order("created_at")
            .execute()
        )
        return result.data

    def find_duplicate(self, match_id: UUID, content_hash: str) -> dict | None:
        result = (
            self.db.table(SCREENSHOTS)
            .select("id")
            .eq("match_id", str(match_id))
            .eq("content_hash", content_hash)
            .maybe_single()
            .execute()
        )
        return result.data

    def update_status(
        self,
        screenshot_id: UUID,
        status: OcrStatus,
        raw_ocr_json: dict | None = None,
        error_message: str | None = None,
    ) -> None:
        row: dict = {"ocr_status": status}
        if raw_ocr_json is not None:
            row["raw_ocr_json"] = raw_ocr_json
        if error_message is not None:
            row["error_message"] = error_message
        self.db.table(SCREENSHOTS).update(row).eq("id", str(screenshot_id)).execute()

    def get(self, screenshot_id: UUID) -> dict | None:
        result = (
            self.db.table(SCREENSHOTS)
            .select("*")
            .eq("id", str(screenshot_id))
            .maybe_single()
            .execute()
        )
        return result.data

    def confirm_match_result(
        self,
        screenshot_id: UUID,
        match_id: UUID,
        team_id: UUID,
        placement: int,
        players: list[PlayerKillEntry],
    ) -> None:
        team_kills = sum(p.kills for p in players)
        result_row = {
            "match_id": str(match_id),
            "team_id": str(team_id),
            "placement": placement,
            "team_kills": team_kills,
            "confirmed": True,
        }
        result = self.db.table(MATCH_RESULTS).insert(result_row).execute()
        match_result_id = result.data[0]["id"]

        stat_rows = [
            {
                "match_result_id": match_result_id,
                "player_id": str(p.player_id),
                "kills": p.kills,
                "confirmed": True,
            }
            for p in players
            if p.player_id is not None
        ]
        if stat_rows:
            self.db.table(PLAYER_MATCH_STATS).insert(stat_rows).execute()

        self.update_status(screenshot_id, OcrStatus.COMPLETED)
