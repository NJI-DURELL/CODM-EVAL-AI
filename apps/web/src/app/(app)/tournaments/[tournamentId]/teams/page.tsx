"use client";

import { use } from "react";
import { SwordsIcon } from "lucide-react";

import { useTeams } from "@/lib/queries/teams";
import { useTournamentPlayers } from "@/lib/queries/players";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function TeamsPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const { data: teams, isLoading: teamsLoading } = useTeams(tournamentId);
  const { data: players, isLoading: playersLoading } = useTournamentPlayers(tournamentId);
  const isLoading = teamsLoading || playersLoading;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-semibold tracking-wide">Teams</h2>
        <p className="text-sm text-muted-foreground">
          Discovered automatically from confirmed screenshots — nothing to register here.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && teams?.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SwordsIcon />
            </EmptyMedia>
            <EmptyTitle>No teams yet</EmptyTitle>
            <EmptyDescription>
              Upload a match screenshot and confirm it — the team and its players show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {!isLoading && teams && teams.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => {
            const roster = players?.filter((p) => p.team_id === team.id) ?? [];
            return (
              <Card key={team.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <SwordsIcon className="size-4" />
                    </div>
                    <CardTitle className="text-base">{team.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-1">
                  {roster.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No confirmed players yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {roster.map((player) => (
                        <div key={player.id} className="flex items-center gap-2 text-sm">
                          <Avatar size="sm">
                            <AvatarFallback className="bg-primary/15 text-primary">
                              {player.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{player.name}</span>
                          {player.ign && (
                            <span className="text-xs text-muted-foreground">({player.ign})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
