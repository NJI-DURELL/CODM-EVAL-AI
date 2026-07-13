export type OcrStatus = "uploading" | "ocr" | "calculating" | "completed" | "failed";

export interface Tournament {
  id: string;
  organizer_id: string;
  name: string;
  logo_url: string | null;
  event_date: string | null;
  placement_points: Record<string, number>;
  kill_point_value: number;
  status: string;
  created_at: string;
}

export interface TournamentCreate {
  name: string;
  logo_url?: string | null;
  event_date?: string | null;
  placement_points?: Record<string, number> | null;
  kill_point_value?: number | null;
}

export interface Team {
  id: string;
  tournament_id: string;
  name: string;
}

export interface TeamCreate {
  name: string;
}

export interface Player {
  id: string;
  team_id: string;
  name: string;
  ign: string | null;
}

export interface PlayerCreate {
  name: string;
  ign?: string | null;
}

export interface Match {
  id: string;
  tournament_id: string;
  match_number: number;
}

export interface MatchCreate {
  match_number: number;
}

export interface ScreenshotUploadResult {
  id: string;
  match_id: string;
  team_id: string | null;
  ocr_status: OcrStatus;
}

export interface ScreenshotSummary {
  id: string;
  match_id: string;
  team_id: string | null;
  ocr_status: OcrStatus;
  error_message: string | null;
  created_at: string;
}

export interface PlayerKillEntry {
  player_id: string | null;
  ocr_name: string;
  matched_name: string | null;
  match_confidence: number | null;
  kills: number;
}

export interface OcrReviewPayload {
  screenshot_id: string;
  placement: number | null;
  team_kills: number | null;
  players: PlayerKillEntry[];
  needs_review: boolean;
  error_message: string | null;
  suggested_team_id: string | null;
  suggested_team_name: string | null;
}

export interface MatchResultConfirm {
  screenshot_id: string;
  placement: number;
  players: PlayerKillEntry[];
  team_id?: string | null;
  team_name?: string | null;
}

export interface TeamLeaderboardRow {
  team_id: string;
  team_name: string;
  games_played: number;
  total_kills: number;
  placement_points: number;
  kill_points: number;
  total_points: number;
}

export interface PlayerLeaderboardRow {
  player_id: string;
  player_name: string;
  team_name: string;
  games_played: number;
  total_kills: number;
  avg_kills_per_game: number;
}

export interface Awards {
  mvp: PlayerLeaderboardRow | null;
  best_team: TeamLeaderboardRow | null;
  most_kills_team: TeamLeaderboardRow | null;
}
