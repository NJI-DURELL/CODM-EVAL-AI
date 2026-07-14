import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Match, MatchCreate, MatchResultSummary } from "@/lib/types";

export const matchKeys = {
  list: (tournamentId: string) => ["tournaments", tournamentId, "matches"] as const,
  results: (tournamentId: string, matchId: string) =>
    ["tournaments", tournamentId, "matches", matchId, "results"] as const,
};

export function useMatches(tournamentId: string) {
  return useQuery({
    queryKey: matchKeys.list(tournamentId),
    queryFn: () => apiFetch<Match[]>(`/tournaments/${tournamentId}/matches`),
    enabled: !!tournamentId,
  });
}

export function useMatch(tournamentId: string, matchId: string) {
  const { data: matches, ...rest } = useMatches(tournamentId);
  return { data: matches?.find((m) => m.id === matchId), ...rest };
}

export function useMatchResults(tournamentId: string, matchId: string | null) {
  return useQuery({
    queryKey: matchId ? matchKeys.results(tournamentId, matchId) : ["match-results-disabled"],
    queryFn: () =>
      apiFetch<MatchResultSummary[]>(`/tournaments/${tournamentId}/matches/${matchId}/results`),
    enabled: !!tournamentId && !!matchId,
  });
}

export function useCreateMatch(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MatchCreate) =>
      apiFetch<Match>(`/tournaments/${tournamentId}/matches`, { method: "POST", body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: matchKeys.list(tournamentId) });
    },
  });
}
