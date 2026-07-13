"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon, GamepadIcon, ArrowRightIcon } from "lucide-react";

import { useCreateMatch, useMatches } from "@/lib/queries/matches";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const schema = z.object({
  match_number: z.coerce.number().int().min(1, "Match number must be at least 1."),
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

function OpenMatchDialog({ tournamentId }: { tournamentId: string }) {
  const [open, setOpen] = useState(false);
  const createMatch = useCreateMatch(tournamentId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormOutput) {
    try {
      const match = await createMatch.mutateAsync({ match_number: values.match_number });
      toast.success(`Match #${match.match_number} ready`);
      setOpen(false);
      reset();
    } catch (error) {
      toast.error("Couldn't open match", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Open match
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a match</DialogTitle>
          <DialogDescription>Reopening an existing match number takes you right back to it.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.match_number}>
              <FieldLabel htmlFor="match-number">Match number</FieldLabel>
              <Input
                id="match-number"
                type="number"
                min={1}
                aria-invalid={!!errors.match_number}
                {...register("match_number")}
              />
              <FieldError errors={[errors.match_number]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={createMatch.isPending}>
              {createMatch.isPending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
              Open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MatchesPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = use(params);
  const { data: matches, isLoading } = useMatches(tournamentId);
  const sorted = [...(matches ?? [])].sort((a, b) => a.match_number - b.match_number);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-xl font-semibold tracking-wide">Matches</h2>
        <OpenMatchDialog tournamentId={tournamentId} />
      </div>

      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && sorted.length === 0 && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <GamepadIcon />
            </EmptyMedia>
            <EmptyTitle>No matches yet</EmptyTitle>
            <EmptyDescription>Open match 1 to start uploading scoreboards.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <OpenMatchDialog tournamentId={tournamentId} />
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && sorted.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((match) => (
            <Link key={match.id} href={`/tournaments/${tournamentId}/matches/${match.id}`}>
              <Card className="h-full ring-1 ring-foreground/10 transition-colors hover:ring-primary/40">
                <CardContent className="flex items-center gap-3 pt-1">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GamepadIcon className="size-4.5" />
                  </div>
                  <div className="flex-1 font-heading text-sm font-semibold tracking-wide">
                    Match {match.match_number}
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
