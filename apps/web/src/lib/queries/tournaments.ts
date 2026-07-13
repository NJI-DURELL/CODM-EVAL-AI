import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Tournament, TournamentCreate } from "@/lib/types";

export const tournamentKeys = {
  all: ["tournaments"] as const,
  detail: (id: string) => ["tournaments", id] as const,
};

export function useTournaments() {
  return useQuery({
    queryKey: tournamentKeys.all,
    queryFn: () => apiFetch<Tournament[]>("/tournaments"),
  });
}

export function useTournament(tournamentId: string) {
  return useQuery({
    queryKey: tournamentKeys.detail(tournamentId),
    queryFn: () => apiFetch<Tournament>(`/tournaments/${tournamentId}`),
    enabled: !!tournamentId,
  });
}

export function useCreateTournament() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TournamentCreate) =>
      apiFetch<Tournament>("/tournaments", { method: "POST", body: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tournamentKeys.all });
    },
  });
}
