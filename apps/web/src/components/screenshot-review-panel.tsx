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
import { Badge } from "@/components/ui/badge";
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

interface TeamCardState {
  ocrLabel: string;
  placement: string;
  rows: PlayerKillEntry[];
  selectedTeamId: string;
  newTeamName: string;
  needsReview: boolean;
}

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

  const [cards, setCards] = useState<TeamCardState[]>([]);
  const [syncedScreenshotId, setSyncedScreenshotId] = useState<string | null>(null);

  const hasResult = review && review.teams.length > 0;
  if (hasResult && syncedScreenshotId !== screenshotId) {
    setSyncedScreenshotId(screenshotId);
    setCards(
      review.teams.map((team) => ({
        ocrLabel: team.ocr_label,
        placement: team.placement?.toString() ?? "",
        rows: team.players,
        selectedTeamId: team.suggested_team_id ?? NEW_TEAM,
        newTeamName: team.suggested_team_id ? "" : team.suggested_team_name ?? "",
        needsReview: team.needs_review,
      }))
    );
  }

  const stillWorking = !review?.error_message && review?.teams.length === 0;

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

  function updateCard(cardIndex: number, patch: Partial<TeamCardState>) {
    setCards((prev) => prev.map((card, i) => (i === cardIndex ? { ...card, ...patch } : card)));
  }

  function updateRow(cardIndex: number, rowIndex: number, patch: Partial<PlayerKillEntry>) {
    setCards((prev) =>
      prev.map((card, i) =>
        i === cardIndex
          ? { ...card, rows: card.rows.map((row, j) => (j === rowIndex ? { ...row, ...patch } : row)) }
          : card
      )
    );
  }

  async function handleConfirmAll() {
    for (const card of cards) {
      const placementNumber = Number(card.placement);
      if (!placementNumber || placementNumber < 1) {
        toast.error(`Enter a valid placement for ${card.ocrLabel} (1 or higher).`);
        return;
      }
      if (card.selectedTeamId === NEW_TEAM && !card.newTeamName.trim()) {
        toast.error(`Name the team for ${card.ocrLabel} before confirming.`);
        return;
      }
    }

    try {
      await confirmScreenshot.mutateAsync({
        screenshot_id: screenshotId,
        teams: cards.map((card) => ({
          placement: Number(card.placement),
          players: card.rows,
          team_id: card.selectedTeamId === NEW_TEAM ? null : card.selectedTeamId,
          team_name: card.selectedTeamId === NEW_TEAM ? card.newTeamName.trim() : null,
        })),
      });
      toast.success("Results confirmed");
      onConfirmed();
    } catch (error) {
      toast.error("Couldn't confirm results", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const anyNeedsReview = cards.some((c) => c.needsReview);

  return (
    <div className="flex flex-col gap-4">
      {anyNeedsReview && (
        <Alert>
          <TriangleAlertIcon />
          <AlertTitle>Double-check the flagged teams</AlertTitle>
          <AlertDescription>
            OCR wasn&apos;t fully confident on some teams below — verify the team, placement, and any
            low-confidence names before confirming.
          </AlertDescription>
        </Alert>
      )}

      {cards.map((card, cardIndex) => {
        const newPlayerCount = card.rows.filter(
          (r) => !r.player_id && (r.matched_name || r.ocr_name).trim()
        ).length;

        return (
          <div key={cardIndex} className="flex flex-col gap-4 rounded-xl border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{card.ocrLabel}</span>
              {card.needsReview && <Badge variant="secondary">Needs review</Badge>}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor={`team-${cardIndex}`}>Team</FieldLabel>
                <Select
                  value={card.selectedTeamId}
                  onValueChange={(value) => updateCard(cardIndex, { selectedTeamId: value ?? NEW_TEAM })}
                >
                  <SelectTrigger id={`team-${cardIndex}`} className="w-full">
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
                {card.selectedTeamId === NEW_TEAM && (
                  <Input
                    className="mt-2"
                    value={card.newTeamName}
                    onChange={(e) => updateCard(cardIndex, { newTeamName: e.target.value })}
                    placeholder="Name this team, e.g. Alpha Squad"
                  />
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor={`placement-${cardIndex}`}>Placement</FieldLabel>
                <Input
                  id={`placement-${cardIndex}`}
                  type="number"
                  min={1}
                  value={card.placement}
                  onChange={(e) => updateCard(cardIndex, { placement: e.target.value })}
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
                {card.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
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
                          updateRow(cardIndex, rowIndex, {
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
                        onChange={(e) => updateRow(cardIndex, rowIndex, { kills: Number(e.target.value) || 0 })}
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
          </div>
        );
      })}

      <Button onClick={handleConfirmAll} disabled={confirmScreenshot.isPending} className="w-fit self-end">
        {confirmScreenshot.isPending ? (
          <Loader2Icon data-icon="inline-start" className="animate-spin" />
        ) : (
          <CheckIcon data-icon="inline-start" />
        )}
        Confirm all results
      </Button>
    </div>
  );
}
