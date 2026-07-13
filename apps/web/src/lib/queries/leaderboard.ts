import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Awards, PlayerLeaderboardRow, TeamLeaderboardRow } from "@/lib/types";

export function useTeamLeaderboard(tournamentId: string) {
  return useQuery({
    queryKey: ["tournaments", tournamentId, "leaderboard", "teams"],
    queryFn: () =>
      apiFetch<TeamLeaderboardRow[]>(`/tournaments/${tournamentId}/leaderboard/teams`),
    enabled: !!tournamentId,
  });
}

export function usePlayerLeaderboard(tournamentId: string) {
  return useQuery({
    queryKey: ["tournaments", tournamentId, "leaderboard", "players"],
    queryFn: () =>
      apiFetch<PlayerLeaderboardRow[]>(`/tournaments/${tournamentId}/leaderboard/players`),
    enabled: !!tournamentId,
  });
}

export function useAwards(tournamentId: string) {
  return useQuery({
    queryKey: ["tournaments", tournamentId, "leaderboard", "awards"],
    queryFn: () => apiFetch<Awards>(`/tournaments/${tournamentId}/leaderboard/awards`),
    enabled: !!tournamentId,
  });
}
