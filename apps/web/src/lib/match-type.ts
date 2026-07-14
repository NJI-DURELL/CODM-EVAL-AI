import type { MatchType } from "@/lib/types";

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  placement: "Placement only",
  kills: "Kills only",
  both: "Placement + kills",
};

export function matchTypeBadgeLabel(matchType: MatchType) {
  return matchType === "both" ? "BOTH" : matchType.toUpperCase();
}
