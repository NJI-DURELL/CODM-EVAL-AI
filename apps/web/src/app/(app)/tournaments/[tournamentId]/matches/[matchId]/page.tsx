"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeftIcon, UploadIcon, Loader2Icon, ImageIcon } from "lucide-react";

import { useMatch } from "@/lib/queries/matches";
import { useTournamentRoster } from "@/lib/queries/roster";
import { useMatchScreenshots, useUploadScreenshot } from "@/lib/queries/screenshots";
import { OcrStatusBadge } from "@/components/ocr-status-badge";
import { ScreenshotReviewPanel } from "@/components/screenshot-review-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function MatchDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string; matchId: string }>;
}) {
  const { tournamentId, matchId } = use(params);
  const { data: match } = useMatch(tournamentId, matchId);
  const { data: clans, isLoading: rosterLoading } = useTournamentRoster(tournamentId);
  const { data: screenshots, isLoading: screenshotsLoading } = useMatchScreenshots(tournamentId, matchId);
  const uploadScreenshot = useUploadScreenshot(tournamentId, matchId);

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [activeScreenshotId, setActiveScreenshotId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTeams = clans.flatMap((clan) => clan.teams.map((team) => ({ ...team, clanName: clan.name, clanId: clan.id })));
  const activeScreenshot = screenshots?.find((s) => s.id === activeScreenshotId);
  const activeTeam = activeScreenshot ? allTeams.find((t) => t.id === activeScreenshot.team_id) : undefined;

  function teamLabel(teamId: string) {
    const team = allTeams.find((t) => t.id === teamId);
    return team ? `${team.name} · ${team.clanName}` : "Unknown team";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selectedTeamId) return;

    try {
      const result = await uploadScreenshot.mutateAsync({ teamId: selectedTeamId, file });
      toast.success("Screenshot uploaded — reading scoreboard…");
      setActiveScreenshotId(result.id);
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/tournaments/${tournamentId}/matches`}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" />
        All matches
      </Link>

      <h2 className="font-heading text-xl font-semibold tracking-wide">
        {match ? `Match ${match.match_number}` : <Skeleton className="h-7 w-32" />}
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload a scoreboard</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium">Team</label>
            <Select
              value={selectedTeamId}
              onValueChange={(value) => setSelectedTeamId(value ?? "")}
              disabled={rosterLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose the team uploading this screenshot" />
              </SelectTrigger>
              <SelectContent>
                {clans.map((clan) => (
                  <SelectGroup key={clan.id}>
                    <SelectLabel>{clan.name}</SelectLabel>
                    {clan.teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            disabled={!selectedTeamId || uploadScreenshot.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploadScreenshot.isPending ? (
              <Loader2Icon data-icon="inline-start" className="animate-spin" />
            ) : (
              <UploadIcon data-icon="inline-start" />
            )}
            Upload screenshot
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Screenshots</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 pt-1">
            {screenshotsLoading && <Skeleton className="h-32 rounded-lg" />}
            {!screenshotsLoading && screenshots?.length === 0 && (
              <Empty className="p-4">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageIcon />
                  </EmptyMedia>
                  <EmptyTitle className="text-xs">No uploads yet</EmptyTitle>
                  <EmptyDescription className="text-xs">
                    Pick a team above and upload its scoreboard.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {screenshots?.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveScreenshotId(s.id)}
                className={`flex flex-col gap-1.5 rounded-lg border p-2.5 text-left text-sm transition-colors ${
                  activeScreenshotId === s.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">{teamLabel(s.team_id)}</span>
                <OcrStatusBadge status={s.ocr_status} />
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {activeScreenshot ? `Review — ${teamLabel(activeScreenshot.team_id)}` : "Review"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            {!activeScreenshot && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Select a screenshot from the list to review its OCR result.
              </p>
            )}
            {activeScreenshot && activeTeam && (
              <ScreenshotReviewPanel
                tournamentId={tournamentId}
                matchId={matchId}
                screenshotId={activeScreenshot.id}
                teamId={activeScreenshot.team_id}
                clanId={activeTeam.clanId}
                onConfirmed={() => setActiveScreenshotId(null)}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
