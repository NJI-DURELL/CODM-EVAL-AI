import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Player } from "@/lib/types";

export const playerKeys = {
  tournamentList: (tournamentId: string) => ["tournaments", tournamentId, "players"] as const,
};

/** Every player discovered so far in the tournament, across all teams —
 * there's no fixed per-team roster to scope to anymore. */
export function useTournamentPlayers(tournamentId: string) {
  return useQuery({
    queryKey: playerKeys.tournamentList(tournamentId),
    queryFn: () => apiFetch<Player[]>(`/tournaments/${tournamentId}/players`),
    enabled: !!tournamentId,
  });
}
