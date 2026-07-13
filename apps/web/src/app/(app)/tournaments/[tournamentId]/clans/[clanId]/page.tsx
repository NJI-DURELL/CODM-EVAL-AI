"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon, SwordsIcon, ArrowRightIcon, ArrowLeftIcon } from "lucide-react";

import { useClan } from "@/lib/queries/clans";
import { MAX_TEAMS_PER_CLAN, isTeamLimitError, useCreateTeam, useTeams } from "@/lib/queries/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const schema = z.object({ name: z.string().min(1, "Give the team a name.") });
type FormValues = z.infer<typeof schema>;

function CreateTeamDialog({
  tournamentId,
  clanId,
  atLimit,
}: {
  tournamentId: string;
  clanId: string;
  atLimit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const createTeam = useCreateTeam(tournamentId, clanId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const team = await createTeam.mutateAsync({ name: values.name });
      toast.success(`${team.name} added`);
      setOpen(false);
      reset();
    } catch (error) {
      if (isTeamLimitError(error)) {
        toast.error("This clan is full", { description: `Max ${MAX_TEAMS_PER_CLAN} teams per clan.` });
      } else {
        toast.error("Couldn't add team", {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button disabled={atLimit} />}>
        <PlusIcon data-icon="inline-start" />
        Add team
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="team-name">Team name</FieldLabel>
              <Input id="team-name" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={createTeam.isPending}>
              {createTeam.isPending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
              Add team
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClanDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string; clanId: string }>;
}) {
  const { tournamentId, clanId } = use(params);
  const { data: clan } = useClan(tournamentId, clanId);
  const { data: teams, isLoading } = useTeams(tournamentId, clanId);
  const atLimit = (teams?.length ?? 0) >= MAX_TEAMS_PER_CLAN;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/tournaments/${tournamentId}/clans`}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" />
        All clans
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-wide">
          {clan?.name ?? <Skeleton className="h-7 w-40" />}
        </h2>
        <CreateTeamDialog tournamentId={tournamentId} clanId={clanId} atLimit={atLimit} />
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
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
            <EmptyDescription>Add up to {MAX_TEAMS_PER_CLAN} teams for this clan.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateTeamDialog tournamentId={tournamentId} clanId={clanId} atLimit={atLimit} />
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && teams && teams.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <Link key={team.id} href={`/tournaments/${tournamentId}/clans/${clanId}/teams/${team.id}`}>
              <Card className="h-full ring-1 ring-foreground/10 transition-colors hover:ring-primary/40">
                <CardContent className="flex items-center gap-3 pt-1">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <SwordsIcon className="size-4.5" />
                  </div>
                  <div className="flex-1 font-heading text-sm font-semibold tracking-wide">{team.name}</div>
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
