import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Team } from "@/lib/types";

export const teamKeys = {
  list: (tournamentId: string) => ["tournaments", tournamentId, "teams"] as const,
};

export function useTeams(tournamentId: string) {
  return useQuery({
    queryKey: teamKeys.list(tournamentId),
    queryFn: () => apiFetch<Team[]>(`/tournaments/${tournamentId}/teams`),
    enabled: !!tournamentId,
  });
}

export function useTeam(tournamentId: string, teamId: string) {
  const { data: teams, ...rest } = useTeams(tournamentId);
  return { data: teams?.find((t) => t.id === teamId), ...rest };
}
