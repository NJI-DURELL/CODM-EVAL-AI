"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon, ShieldIcon, ArrowRightIcon } from "lucide-react";

import { useClans, useCreateClan } from "@/lib/queries/clans";
import { useTournamentRoster } from "@/lib/queries/roster";
import { MAX_TEAMS_PER_CLAN } from "@/lib/queries/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

const schema = z.object({ name: z.string().min(2, "Give it a name (2+ characters).") });
type FormValues = z.infer<typeof schema>;

function CreateClanDialog({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(false);
  const createClan = useCreateClan(tournamentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const clan = await createClan.mutateAsync({ name: values.name });
      toast.success(`${clan.name} registered`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error("Couldn't create clan", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Register clan
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a clan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="clan-name">Clan name</FieldLabel>
              <Input id="clan-name" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={createClan.isPending}>
              {createClan.isPending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
              Register
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ClansPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const { isLoading } = useClans(tournamentId);
  const { data: clans } = useTournamentRoster(tournamentId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-wide">Clans</h2>
        <CreateClanDialog tournamentId={tournamentId} />
      </div>

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && clans.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldIcon />
            </EmptyMedia>
            <EmptyTitle>No clans registered</EmptyTitle>
            <EmptyDescription>Register the first clan to start building rosters.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <CreateClanDialog tournamentId={tournamentId} />
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && clans.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clans.map((clan) => (
            <Link key={clan.id} href={`/tournaments/${tournamentId}/clans/${clan.id}`}>
              <Card className="h-full ring-1 ring-foreground/10 transition-colors hover:ring-primary/40">
                <CardContent className="flex items-center gap-3 pt-1">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldIcon className="size-4.5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-heading text-sm font-semibold tracking-wide">{clan.name}</div>
                    <Badge variant="secondary" className="mt-1">
                      {clan.teams.length}/{MAX_TEAMS_PER_CLAN} teams
                    </Badge>
                  </div>
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
