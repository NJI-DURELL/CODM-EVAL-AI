import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiFetch } from "@/lib/api";
import type { Team, TeamCreate } from "@/lib/types";

export const MAX_TEAMS_PER_CLAN = 5;

export const teamKeys = {
  list: (tournamentId: string, clanId: string) =>
    ["tournaments", tournamentId, "clans", clanId, "teams"] as const,
};

export function useTeams(tournamentId: string, clanId: string) {
  return useQuery({
    queryKey: teamKeys.list(tournamentId, clanId),
    queryFn: () => apiFetch<Team[]>(`/tournaments/${tournamentId}/clans/${clanId}/teams`),
    enabled: !!tournamentId && !!clanId,
  });
}

export function useTeam(tournamentId: string, clanId: string, teamId: string) {
  const { data: teams, ...rest } = useTeams(tournamentId, clanId);
  return { data: teams?.find((t) => t.id === teamId), ...rest };
}

export function useCreateTeam(tournamentId: string, clanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamCreate) =>
      apiFetch<Team>(`/tournaments/${tournamentId}/clans/${clanId}/teams`, {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.list(tournamentId, clanId) });
    },
  });
}

export function isTeamLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400;
}
