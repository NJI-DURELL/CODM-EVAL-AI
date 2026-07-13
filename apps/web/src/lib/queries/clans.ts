import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Clan, ClanCreate } from "@/lib/types";

export const clanKeys = {
  list: (tournamentId: string) => ["tournaments", tournamentId, "clans"] as const,
};

export function useClans(tournamentId: string) {
  return useQuery({
    queryKey: clanKeys.list(tournamentId),
    queryFn: () => apiFetch<Clan[]>(`/tournaments/${tournamentId}/clans`),
    enabled: !!tournamentId,
  });
}

export function useClan(tournamentId: string, clanId: string) {
  const { data: clans, ...rest } = useClans(tournamentId);
  return { data: clans?.find((c) => c.id === clanId), ...rest };
}

export function useCreateClan(tournamentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ClanCreate) =>
      apiFetch<Clan>(`/tournaments/${tournamentId}/clans`, { method: "POST", body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clanKeys.list(tournamentId) });
    },
  });
}
