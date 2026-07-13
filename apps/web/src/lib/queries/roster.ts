import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useClans } from "@/lib/queries/clans";
import { teamKeys } from "@/lib/queries/teams";
import type { Clan, Team } from "@/lib/types";

export interface ClanWithTeams extends Clan {
  teams: Team[];
}

/** Clans + their teams for a tournament, for pickers that need the full org tree
 * (e.g. "which team is uploading this screenshot"). No single backend endpoint
 * returns this shape, so we fan out one teams-list request per clan. */
export function useTournamentRoster(tournamentId: string) {
  const { data: clans, isLoading: clansLoading } = useClans(tournamentId);

  const teamQueries = useQueries({
    queries: (clans ?? []).map((clan) => ({
      queryKey: teamKeys.list(tournamentId, clan.id),
      queryFn: () => apiFetch<Team[]>(`/tournaments/${tournamentId}/clans/${clan.id}/teams`),
      enabled: !!clans,
    })),
  });

  const isLoading = clansLoading || teamQueries.some((q) => q.isLoading);

  const clanWithTeams: ClanWithTeams[] = (clans ?? []).map((clan, i) => ({
    ...clan,
    teams: teamQueries[i]?.data ?? [],
  }));

  return { data: clanWithTeams, isLoading };
}
