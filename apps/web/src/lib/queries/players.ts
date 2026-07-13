import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Player, PlayerCreate } from "@/lib/types";

export const playerKeys = {
  list: (tournamentId: string, clanId: string, teamId: string) =>
    ["tournaments", tournamentId, "clans", clanId, "teams", teamId, "players"] as const,
};

export function usePlayers(tournamentId: string, clanId: string, teamId: string) {
  return useQuery({
    queryKey: playerKeys.list(tournamentId, clanId, teamId),
    queryFn: () =>
      apiFetch<Player[]>(
        `/tournaments/${tournamentId}/clans/${clanId}/teams/${teamId}/players`
      ),
    enabled: !!tournamentId && !!clanId && !!teamId,
  });
}

export function useCreatePlayer(tournamentId: string, clanId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlayerCreate) =>
      apiFetch<Player>(
        `/tournaments/${tournamentId}/clans/${clanId}/teams/${teamId}/players`,
        { method: "POST", body: payload }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: playerKeys.list(tournamentId, clanId, teamId) });
    },
  });
}
