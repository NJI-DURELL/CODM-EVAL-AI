"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";

import { useConfirmScreenshot, useScreenshotReview } from "@/lib/queries/screenshots";
import { usePlayers } from "@/lib/queries/players";
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
  teamId,
  clanId,
  onConfirmed,
}: {
  tournamentId: string;
  matchId: string;
  screenshotId: string;
  teamId: string;
  clanId: string;
  onConfirmed: () => void;
}) {
  const { data: review, isLoading } = useScreenshotReview(tournamentId, matchId, screenshotId);
  const { data: roster } = usePlayers(tournamentId, clanId, teamId);
  const confirmScreenshot = useConfirmScreenshot(tournamentId, matchId);

  const [placement, setPlacement] = useState<string>("");
  const [rows, setRows] = useState<PlayerKillEntry[]>([]);
  const [syncedScreenshotId, setSyncedScreenshotId] = useState<string | null>(null);

  const hasResult = review && (review.placement !== null || review.players.length > 0);
  if (hasResult && syncedScreenshotId !== screenshotId) {
    setSyncedScreenshotId(screenshotId);
    setPlacement(review.placement?.toString() ?? "");
    setRows(review.players);
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

    try {
      await confirmScreenshot.mutateAsync({
        screenshot_id: screenshotId,
        placement: placementNumber,
        players: rows,
      });
      toast.success("Result confirmed");
      onConfirmed();
    } catch (error) {
      toast.error("Couldn't confirm result", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const unresolvedCount = rows.filter((r) => !r.player_id).length;

  return (
    <div className="flex flex-col gap-4">
      {review?.needs_review && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Double-check this one</AlertTitle>
          <AlertDescription>
            OCR wasn&apos;t fully confident here — verify placement and any low-confidence names before confirming.
          </AlertDescription>
        </Alert>
      )}

      <Field className="max-w-40">
        <FieldLabel htmlFor="placement">Placement</FieldLabel>
        <Input
          id="placement"
          type="number"
          min={1}
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
        />
      </Field>

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
                          : roster?.find((p) => p.id === value)?.ign ??
                            roster?.find((p) => p.id === value)?.name ??
                            null,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unmatched" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value={UNMATCHED}>Unmatched (kills still count for team)</SelectItem>
                      {roster?.map((player) => (
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

      {unresolvedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {unresolvedCount} row{unresolvedCount > 1 ? "s" : ""} unmatched to a roster player — their kills
          still count toward the team total, just not toward individual stats.
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
