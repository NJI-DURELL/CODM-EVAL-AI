"use client";

import Link from "next/link";
import { TrophyIcon, CalendarIcon } from "lucide-react";

import { useTournaments } from "@/lib/queries/tournaments";
import { CreateTournamentDialog } from "@/components/create-tournament-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function DashboardPage() {
  const { data: tournaments, isLoading } = useTournaments();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-wide">Your tournaments</h1>
          <p className="text-sm text-muted-foreground">
            Pick one up or start a new one.
          </p>
        </div>
        <CreateTournamentDialog />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && tournaments?.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrophyIcon />
            </EmptyMedia>
            <EmptyTitle>No tournaments yet</EmptyTitle>
            <EmptyDescription>
              Create your first tournament to register clans and start tracking matches.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateTournamentDialog />
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && tournaments && tournaments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
              <Card className="h-full ring-1 ring-foreground/10 transition-colors hover:ring-primary/40">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{tournament.name}</CardTitle>
                    <Badge variant={tournament.status === "active" ? "default" : "secondary"}>
                      {tournament.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarIcon className="size-3.5" />
                    {tournament.event_date
                      ? new Date(tournament.event_date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Date TBD"}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
