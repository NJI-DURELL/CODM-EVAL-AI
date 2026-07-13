import Link from "next/link";
import { Trophy, ScanLine, ListOrdered } from "lucide-react";

import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: ListOrdered,
    title: "Rosters that scale",
    description:
      "Clans, up to five teams each, full player rosters. Set it up once, run every match through it.",
  },
  {
    icon: ScanLine,
    title: "Screenshots in, standings out",
    description:
      "Upload the post-match scoreboard. OCR reads placement and kills, flags anything it isn't sure about for your review.",
  },
  {
    icon: Trophy,
    title: "Live leaderboards & reports",
    description:
      "Team and player standings update the moment you confirm a result. Export a branded PDF recap when the tournament wraps.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flag-stripe h-1 w-full" />
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <span className="font-heading text-lg font-bold tracking-wide">OG CLAN ENGINES</span>
        <div className="flex items-center gap-2">
          <Button render={<Link href="/login" />} variant="ghost">
            Sign in
          </Button>
          <Button render={<Link href="/signup" />}>Get started</Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pt-16 pb-24 text-center sm:pt-24">
        <h1 className="font-heading max-w-3xl text-4xl font-bold tracking-wide text-balance sm:text-6xl">
          Run your CODM clan tournament like it&apos;s the grand finals.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground text-balance">
          Rosters, matches, OCR&apos;d scoreboards, and live standings — one tool from bracket to
          trophy.
        </p>
        <div className="mt-10 flex items-center gap-3">
          <Button render={<Link href="/signup" />} size="lg">
            Start a tournament
          </Button>
          <Button render={<Link href="/login" />} variant="outline" size="lg">
            Sign in
          </Button>
        </div>

        <div className="mt-24 grid w-full max-w-4xl gap-6 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5 ring-1 ring-foreground/5">
              <Icon className="mb-3 size-6 text-primary" />
              <h2 className="font-heading text-base font-semibold tracking-wide">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        Built by OG Clan Engines
      </footer>
    </div>
  );
}
