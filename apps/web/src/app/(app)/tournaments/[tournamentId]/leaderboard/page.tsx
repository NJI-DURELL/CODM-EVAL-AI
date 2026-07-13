"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { CrownIcon, DownloadIcon, Loader2Icon, ShieldIcon, SkullIcon } from "lucide-react";

import { useTournament } from "@/lib/queries/tournaments";
import { useAwards, usePlayerLeaderboard, useTeamLeaderboard } from "@/lib/queries/leaderboard";
import { downloadTournamentReport } from "@/lib/queries/reports";
import { LeaderboardChart } from "@/components/leaderboard-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LeaderboardPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const { data: tournament } = useTournament(tournamentId);
  const { data: teams, isLoading: teamsLoading } = useTeamLeaderboard(tournamentId);
  const { data: players, isLoading: playersLoading } = usePlayerLeaderboard(tournamentId);
  const { data: awards, isLoading: awardsLoading } = useAwards(tournamentId);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadTournamentReport(tournamentId, tournament?.name ?? "tournament");
    } catch (error) {
      toast.error("Couldn't generate report", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-wide">Leaderboard</h2>
        <Button onClick={handleDownload} disabled={downloading} variant="outline">
          {downloading ? (
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
          ) : (
            <DownloadIcon data-icon="inline-start" />
          )}
          Download PDF report
        </Button>
      </div>

      {!awardsLoading && awards && (awards.mvp || awards.best_team || awards.most_kills_team) && (
        <div className="grid gap-4 sm:grid-cols-3">
          <AwardCard icon={CrownIcon} label="MVP" value={awards.mvp?.player_name} detail={awards.mvp ? `${awards.mvp.total_kills} kills · ${awards.mvp.team_name}` : undefined} />
          <AwardCard icon={ShieldIcon} label="Best team" value={awards.best_team?.team_name} detail={awards.best_team ? `${awards.best_team.total_points.toFixed(1)} pts` : undefined} />
          <AwardCard icon={SkullIcon} label="Most kills (team)" value={awards.most_kills_team?.team_name} detail={awards.most_kills_team ? `${awards.most_kills_team.total_kills} kills` : undefined} />
        </div>
      )}

      <Tabs defaultValue="teams">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="players">Players</TabsTrigger>
        </TabsList>

        <TabsContent value="teams" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top teams by points</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {teamsLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <LeaderboardChart
                  color="var(--primary)"
                  unit="pts"
                  data={(teams ?? [])
                    .slice(0, 10)
                    .map((t) => ({
                      name: t.team_name,
                      value: t.total_points,
                      sublabel: `${t.games_played} games`,
                    }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-1">
              {teamsLoading ? (
                <Skeleton className="h-40" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Games</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teams?.map((row, i) => (
                      <TableRow key={row.team_id}>
                        <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.team_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.games_played}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_kills}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {row.total_points.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players" className="mt-4 flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top fraggers</CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              {playersLoading ? (
                <Skeleton className="h-48" />
              ) : (
                <LeaderboardChart
                  color="var(--brand-red)"
                  unit="kills"
                  data={(players ?? [])
                    .slice(0, 10)
                    .map((p) => ({ name: p.player_name, value: p.total_kills, sublabel: p.team_name }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-1">
              {playersLoading ? (
                <Skeleton className="h-40" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead className="text-right">Games</TableHead>
                      <TableHead className="text-right">Kills</TableHead>
                      <TableHead className="text-right">Avg/game</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players?.map((row, i) => (
                      <TableRow key={row.player_id}>
                        <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{row.player_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.team_name}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.games_played}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total_kills}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.avg_kills_per_game.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AwardCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-1">
        <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
          <Icon className="size-3.5 text-[var(--brand-yellow)]" />
          {label}
        </div>
        <div className="font-heading text-lg font-bold">{value ?? "—"}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  );
}
