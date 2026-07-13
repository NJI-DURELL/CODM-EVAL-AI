from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field


class OcrStatus(StrEnum):
    UPLOADING = "uploading"
    OCR = "ocr"
    CALCULATING = "calculating"
    COMPLETED = "completed"
    FAILED = "failed"


class TournamentCreate(BaseModel):
    name: str
    logo_url: str | None = None
    event_date: date | None = None
    placement_points: dict[str, int] | None = None
    kill_point_value: float | None = None


class Tournament(TournamentCreate):
    id: UUID
    organizer_id: UUID
    status: str = "active"
    created_at: datetime


class ClanCreate(BaseModel):
    name: str
    logo_url: str | None = None


class Clan(ClanCreate):
    id: UUID
    tournament_id: UUID


class TeamCreate(BaseModel):
    name: str


class Team(TeamCreate):
    id: UUID
    clan_id: UUID


class PlayerCreate(BaseModel):
    name: str
    ign: str | None = None


class Player(PlayerCreate):
    id: UUID
    team_id: UUID


class MatchCreate(BaseModel):
    match_number: int = Field(gt=0)


class Match(MatchCreate):
    id: UUID
    tournament_id: UUID


class ScreenshotUploadResult(BaseModel):
    id: UUID
    match_id: UUID
    team_id: UUID
    ocr_status: OcrStatus


class ScreenshotSummary(BaseModel):
    id: UUID
    match_id: UUID
    team_id: UUID
    ocr_status: OcrStatus
    error_message: str | None = None
    created_at: datetime


class PlayerKillEntry(BaseModel):
    player_id: UUID | None = None
    ocr_name: str
    matched_name: str | None = None
    match_confidence: float | None = None
    kills: int


class OcrReviewPayload(BaseModel):
    screenshot_id: UUID
    placement: int | None
    team_kills: int | None
    players: list[PlayerKillEntry]
    needs_review: bool
    error_message: str | None = None


class MatchResultConfirm(BaseModel):
    screenshot_id: UUID
    placement: int
    players: list[PlayerKillEntry]


class TeamLeaderboardRow(BaseModel):
    team_id: UUID
    team_name: str
    clan_name: str
    games_played: int
    total_kills: int
    placement_points: int
    kill_points: float
    total_points: float


class PlayerLeaderboardRow(BaseModel):
    player_id: UUID
    player_name: str
    team_name: str
    games_played: int
    total_kills: int
    avg_kills_per_game: float


class Awards(BaseModel):
    mvp: PlayerLeaderboardRow | None
    best_team: TeamLeaderboardRow | None
    most_kills_team: TeamLeaderboardRow | None
