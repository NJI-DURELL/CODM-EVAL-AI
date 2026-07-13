"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";

import { useConfirmScreenshot, useScreenshotReview } from "@/lib/queries/screenshots";
import { useTournamentPlayers } from "@/lib/queries/players";
import { useTeams } from "@/lib/queries/teams";
import type { PlayerKillEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNMATCHED = "__unmatched__";
const NEW_TEAM = "__new_team__";

function confidenceTone(confidence: number | null) {
  if (confidence === null) return "text-muted-foreground";
  if (confidence >= 90) return "text-primary";
  if (confidence >= 80) return "text-[color-mix(in_oklch,var(--brand-yellow),var(--foreground)_25%)]";
  return "text-destructive";
}

export function ScreenshotReviewPanel({
  tournamentId,
  matchId,
  screenshotId,
  onConfirmed,
}: {
  tournamentId: string;
  matchId: string;
  screenshotId: string;
  onConfirmed: () => void;
}) {
  const { data: review, isLoading } = useScreenshotReview(tournamentId, matchId, screenshotId);
  const { data: allPlayers } = useTournamentPlayers(tournamentId);
  const { data: teams } = useTeams(tournamentId);
  const confirmScreenshot = useConfirmScreenshot(tournamentId, matchId);

  const [placement, setPlacement] = useState<string>("");
  const [rows, setRows] = useState<PlayerKillEntry[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>(NEW_TEAM);
  const [newTeamName, setNewTeamName] = useState<string>("");
  const [syncedScreenshotId, setSyncedScreenshotId] = useState<string | null>(null);

  const hasResult = review && (review.placement !== null || review.players.length > 0);
  if (hasResult && syncedScreenshotId !== screenshotId) {
    setSyncedScreenshotId(screenshotId);
    setPlacement(review.placement?.toString() ?? "");
    setRows(review.players);
    setSelectedTeamId(review.suggested_team_id ?? NEW_TEAM);
    setNewTeamName(review.suggested_team_id ? "" : review.suggested_team_name ?? "");
  }

  const stillWorking = !review?.error_message && review?.placement === null && review?.players.length === 0;

  if (isLoading || stillWorking) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <Loader2Icon className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Reading the scoreboard — this updates automatically.</p>
      </div>
    );
  }

  if (review?.error_message) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Couldn&apos;t read this screenshot</AlertTitle>
        <AlertDescription>{review.error_message} Try re-uploading a clearer screenshot.</AlertDescription>
      </Alert>
    );
  }

  function updateRow(index: number, patch: Partial<PlayerKillEntry>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleConfirm() {
    const placementNumber = Number(placement);
    if (!placementNumber || placementNumber < 1) {
      toast.error("Enter a valid placement (1 or higher).");
      return;
    }
    if (selectedTeamId === NEW_TEAM && !newTeamName.trim()) {
      toast.error("Name the team before confirming.");
      return;
    }

    try {
      await confirmScreenshot.mutateAsync({
        screenshot_id: screenshotId,
        placement: placementNumber,
        players: rows,
        team_id: selectedTeamId === NEW_TEAM ? null : selectedTeamId,
        team_name: selectedTeamId === NEW_TEAM ? newTeamName.trim() : null,
      });
      toast.success("Result confirmed");
      onConfirmed();
    } catch (error) {
      toast.error("Couldn't confirm result", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const newPlayerCount = rows.filter((r) => !r.player_id && (r.matched_name || r.ocr_name).trim()).length;

  return (
    <div className="flex flex-col gap-4">
      {review?.needs_review && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Double-check this one</AlertTitle>
          <AlertDescription>
            OCR wasn&apos;t fully confident here — verify the team, placement, and any low-confidence
            names before confirming.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field className="sm:col-span-2">
          <FieldLabel htmlFor="team">Team</FieldLabel>
          <Select value={selectedTeamId} onValueChange={(value) => setSelectedTeamId(value ?? NEW_TEAM)}>
            <SelectTrigger id="team" className="w-full">
              <SelectValue placeholder="Select a team" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={NEW_TEAM}>+ New team</SelectItem>
                {teams?.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {selectedTeamId === NEW_TEAM && (
            <Input
              className="mt-2"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Name this team, e.g. Alpha Squad"
            />
          )}
        </Field>
        <Field>
          <FieldLabel htmlFor="placement">Placement</FieldLabel>
          <Input
            id="placement"
            type="number"
            min={1}
            value={placement}
            onChange={(e) => setPlacement(e.target.value)}
          />
        </Field>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>OCR read</TableHead>
            <TableHead>Matched player</TableHead>
            <TableHead className="w-24">Kills</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              <TableCell className="text-muted-foreground">
                {row.ocr_name}
                {row.match_confidence !== null && (
                  <span className={`ml-2 text-xs tabular-nums ${confidenceTone(row.match_confidence)}`}>
                    {Math.round(row.match_confidence)}%
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Select
                  value={row.player_id ?? UNMATCHED}
                  onValueChange={(value) =>
                    updateRow(i, {
                      player_id: value === UNMATCHED ? null : value,
                      matched_name:
                        value === UNMATCHED
                          ? null
                          : allPlayers?.find((p) => p.id === value)?.ign ??
                            allPlayers?.find((p) => p.id === value)?.name ??
                            null,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="New player" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={UNMATCHED}>New player (from OCR name)</SelectItem>
                      {allPlayers?.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.ign || player.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  value={row.kills}
                  onChange={(e) => updateRow(i, { kills: Number(e.target.value) || 0 })}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {newPlayerCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {newPlayerCount} row{newPlayerCount > 1 ? "s" : ""} will be added as new player
          {newPlayerCount > 1 ? "s" : ""} under this team.
        </p>
      )}

      <Button onClick={handleConfirm} disabled={confirmScreenshot.isPending} className="w-fit self-end">
        {confirmScreenshot.isPending ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <CheckIcon data-icon="inline-start" />
        )}
        Confirm result
      </Button>
    </div>
  );
}
