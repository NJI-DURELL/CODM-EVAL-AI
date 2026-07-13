"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { useTournament } from "@/lib/queries/tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/clans", label: "Clans" },
  { href: "/matches", label: "Matches" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function TournamentHeader({ tournamentId }: { tournamentId: string }) {
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const pathname = usePathname();
  const base = `/tournaments/${tournamentId}`;

  return (
    <div className="border-b border-border bg-card/40">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-2 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3" />
          All tournaments
        </Link>
        {isLoading ? (
          <Skeleton className="h-8 w-64" />
        ) : (
          <h1 className="font-heading text-2xl font-bold tracking-wide">{tournament?.name}</h1>
        )}

        <nav className="mt-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const href = `${base}${tab.href}`;
            const active = pathname === href;
            return (
              <Link
                key={tab.href}
                href={href}
                className={cn(
                  "shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
