from uuid import UUID

from supabase import Client

from app.models.schemas import OcrStatus, TeamResultConfirm

SCREENSHOTS = "screenshots"
MATCH_RESULTS = "match_results"
PLAYER_MATCH_STATS = "player_match_stats"


class ScreenshotRepository:
    def __init__(self, db: Client):
        self.db = db

    def create(self, match_id: UUID, storage_path: str, content_hash: str) -> dict:
        row = {
            "match_id": str(match_id),
            "storage_path": storage_path,
            "content_hash": content_hash,
            "ocr_status": OcrStatus.UPLOADING,
        }
        result = self.db.table(SCREENSHOTS).insert(row).execute()
        return result.data[0]

    def list_for_match(self, match_id: UUID) -> list[dict]:
        result = (
            self.db.table(SCREENSHOTS)
            .select("id, match_id, ocr_status, error_message, created_at")
            .eq("match_id", str(match_id))
            .order("created_at")
            .execute()
        )
        return result.data

    def find_duplicate(self, match_id: UUID, content_hash: str) -> dict | None:
        # maybe_single() returns None outright (not a response with
        # .data=None) when zero rows match.
        result = (
            self.db.table(SCREENSHOTS)
            .select("id")
            .eq("match_id", str(match_id))
            .eq("content_hash", content_hash)
            .maybe_single()
            .execute()
        )
        return result.data if result else None

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
        return result.data if result else None

    def confirm_match_results(
        self,
        screenshot_id: UUID,
        match_id: UUID,
        teams: list[TeamResultConfirm],
        team_ids: list[UUID],
    ) -> None:
        # Upsert (not insert) because a single match's teams are typically
        # confirmed from several overlapping screenshots (e.g. the same
        # scoreboard scrolled to different positions) — re-confirming a team
        # already recorded for this match should update it, not duplicate it.
        result_rows = [
            {
                "match_id": str(match_id),
                "team_id": str(team_id),
                "placement": team.placement,
                "team_kills": sum(p.kills for p in team.players),
                "confirmed": True,
            }
            for team, team_id in zip(teams, team_ids, strict=True)
        ]
        results = (
            self.db.table(MATCH_RESULTS)
            .upsert(result_rows, on_conflict="match_id,team_id")
            .execute()
        )
        match_result_id_by_team_id = {row["team_id"]: row["id"] for row in results.data}

        stat_rows = [
            {
                "match_result_id": match_result_id_by_team_id[str(team_id)],
                "player_id": str(p.player_id),
                "kills": p.kills,
                "confirmed": True,
            }
            for team, team_id in zip(teams, team_ids, strict=True)
            for p in team.players
            if p.player_id is not None
        ]
        if stat_rows:
            self.db.table(PLAYER_MATCH_STATS).upsert(
                stat_rows, on_conflict="match_result_id,player_id"
            ).execute()

        self.db.table(SCREENSHOTS).update({"ocr_status": OcrStatus.COMPLETED}).eq(
            "id", str(screenshot_id)
        ).execute()
