"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon, UserIcon, ArrowLeftIcon } from "lucide-react";

import { useTeam } from "@/lib/queries/teams";
import { useCreatePlayer, usePlayers } from "@/lib/queries/players";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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

const schema = z.object({
  name: z.string().min(1, "Enter the player's name."),
  ign: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function AddPlayerDialog({
  tournamentId,
  clanId,
  teamId,
}: {
  tournamentId: string;
  clanId: string;
  teamId: string;
}) {
  const [open, setOpen] = useState(false);
  const createPlayer = useCreatePlayer(tournamentId, clanId, teamId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const player = await createPlayer.mutateAsync({ name: values.name, ign: values.ign || null });
      toast.success(`${player.name} added to roster`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error("Couldn't add player", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Add player
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a player</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="player-name">Name</FieldLabel>
              <Input id="player-name" aria-invalid={!!errors.name} {...register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.ign}>
              <FieldLabel htmlFor="player-ign">In-game name (optional)</FieldLabel>
              <Input id="player-ign" placeholder="Used to match OCR'd scoreboards" {...register("ign")} />
              <FieldError errors={[errors.ign]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={createPlayer.isPending}>
              {createPlayer.isPending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
              Add player
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TeamRosterPage({
  params,
}: {
  params: Promise<{ tournamentId: string; clanId: string; teamId: string }>;
}) {
  const { tournamentId, clanId, teamId } = use(params);
  const { data: team } = useTeam(tournamentId, clanId, teamId);
  const { data: players, isLoading } = usePlayers(tournamentId, clanId, teamId);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/tournaments/${tournamentId}/clans/${clanId}`}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3" />
        Back to clan
      </Link>

      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-wide">
          {team?.name ?? <Skeleton className="h-7 w-40" />}
        </h2>
        <AddPlayerDialog tournamentId={tournamentId} clanId={clanId} teamId={teamId} />
      </div>

      {isLoading && <Skeleton className="h-40 rounded-xl" />}

      {!isLoading && players?.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserIcon />
            </EmptyMedia>
            <EmptyTitle>No players yet</EmptyTitle>
            <EmptyDescription>
              Add each player&apos;s in-game name so OCR can match scoreboards to this roster.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <AddPlayerDialog tournamentId={tournamentId} clanId={clanId} teamId={teamId} />
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && players && players.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Player</TableHead>
              <TableHead>In-game name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-primary/15 text-primary">
                        {player.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {player.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{player.ign ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
