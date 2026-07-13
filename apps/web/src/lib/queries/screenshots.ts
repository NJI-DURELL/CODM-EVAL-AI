import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  MatchResultConfirm,
  OcrReviewPayload,
  ScreenshotSummary,
  ScreenshotUploadResult,
} from "@/lib/types";

const IN_PROGRESS_STATUSES = new Set(["uploading", "ocr", "calculating"]);

export const screenshotKeys = {
  list: (tournamentId: string, matchId: string) =>
    ["tournaments", tournamentId, "matches", matchId, "screenshots"] as const,
  status: (tournamentId: string, matchId: string, screenshotId: string) =>
    ["tournaments", tournamentId, "matches", matchId, "screenshots", screenshotId] as const,
};

export function useMatchScreenshots(tournamentId: string, matchId: string) {
  return useQuery({
    queryKey: screenshotKeys.list(tournamentId, matchId),
    queryFn: () =>
      apiFetch<ScreenshotSummary[]>(`/tournaments/${tournamentId}/matches/${matchId}/screenshots`),
    enabled: !!tournamentId && !!matchId,
    refetchInterval: (query) =>
      query.state.data?.some((s) => IN_PROGRESS_STATUSES.has(s.ocr_status)) ? 2000 : false,
  });
}

export function useUploadScreenshot(tournamentId: string, matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, file }: { teamId: string; file: File }) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<ScreenshotUploadResult>(
        `/tournaments/${tournamentId}/matches/${matchId}/teams/${teamId}/screenshots`,
        { method: "POST", formData }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: screenshotKeys.list(tournamentId, matchId) });
    },
  });
}

export function useScreenshotReview(tournamentId: string, matchId: string, screenshotId: string | null) {
  return useQuery({
    queryKey: screenshotId ? screenshotKeys.status(tournamentId, matchId, screenshotId) : ["screenshot-review-disabled"],
    queryFn: () =>
      apiFetch<OcrReviewPayload>(
        `/tournaments/${tournamentId}/matches/${matchId}/screenshots/${screenshotId}`
      ),
    enabled: !!tournamentId && !!matchId && !!screenshotId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      const stillWorking = !data.error_message && data.placement === null && data.players.length === 0;
      return stillWorking ? 2000 : false;
    },
  });
}

export function useConfirmScreenshot(tournamentId: string, matchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MatchResultConfirm) =>
      apiFetch<void>(
        `/tournaments/${tournamentId}/matches/${matchId}/screenshots/${payload.screenshot_id}/confirm`,
        { method: "POST", body: payload }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: screenshotKeys.list(tournamentId, matchId) });
      queryClient.invalidateQueries({ queryKey: ["tournaments", tournamentId, "leaderboard"] });
    },
  });
}
