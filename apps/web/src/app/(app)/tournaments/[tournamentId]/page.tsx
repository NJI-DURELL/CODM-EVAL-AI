"use client";

import { use } from "react";
import Link from "next/link";
import { SwordsIcon, ImageUpIcon, GamepadIcon, ArrowRightIcon } from "lucide-react";

import { useTournament } from "@/lib/queries/tournaments";
import { useTeams } from "@/lib/queries/teams";
import { useMatches } from "@/lib/queries/matches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function TournamentOverviewPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const { data: tournament } = useTournament(tournamentId);
  const { data: teams, isLoading: teamsLoading } = useTeams(tournamentId);
  const { data: matches, isLoading: matchesLoading } = useMatches(tournamentId);

  const isLoading = teamsLoading || matchesLoading;

  const stats = [
    { icon: SwordsIcon, label: "Teams discovered", value: teams?.length ?? 0 },
    { icon: GamepadIcon, label: "Matches", value: matches?.length ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map(({ icon: Icon, label, value }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 pt-1">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4.5" />
              </div>
              <div>
                {isLoading ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <div className="font-heading text-xl font-bold">{value}</div>
                )}
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink
          href={`/tournaments/${tournamentId}/matches`}
          icon={ImageUpIcon}
          title="Upload a screenshot"
          description="Players and teams are pulled from the scoreboard automatically."
        />
        <QuickLink
          href={`/tournaments/${tournamentId}/teams`}
          icon={SwordsIcon}
          title="Review teams & players"
          description="See what's been discovered so far and rename anything OCR got wrong."
        />
      </div>

      {tournament && (
        <Card>
          <CardHeader>
            <CardTitle>Scoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Kill point value</div>
                <div className="font-medium">{tournament.kill_point_value} pt / kill</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1 text-xs text-muted-foreground">Placement points</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(tournament.placement_points)
                    .sort(([a], [b]) => Number(a) - Number(b))
                    .map(([place, points]) => (
                      <span
                        key={place}
                        className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground"
                      >
                        #{place}: {points}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full ring-1 ring-foreground/10 transition-colors hover:ring-primary/40">
        <CardContent className="flex items-center gap-4 pt-1">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-heading text-sm font-semibold tracking-wide">{title}</div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
          <Button variant="ghost" size="icon-sm" tabIndex={-1}>
            <ArrowRightIcon />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
