"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PlusIcon, Loader2Icon } from "lucide-react";

import { useCreateTournament } from "@/lib/queries/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const schema = z.object({
  name: z.string().min(2, "Give it a name (2+ characters)."),
  event_date: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateTournamentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const createTournament = useCreateTournament();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const tournament = await createTournament.mutateAsync({
        name: values.name,
        event_date: values.event_date || null,
      });
      toast.success(`${tournament.name} created`);
      setOpen(false);
      reset();
      router.push(`/tournaments/${tournament.id}`);
    } catch (error) {
      toast.error("Couldn't create tournament", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        New tournament
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New tournament</DialogTitle>
          <DialogDescription>
            Placement points and kill values start at the standard defaults — you can tune them later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Tournament name</FieldLabel>
              <Input
                id="name"
                placeholder="OG Clan Invitational"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={!!errors.event_date}>
              <FieldLabel htmlFor="event_date">Event date</FieldLabel>
              <Input id="event_date" type="date" {...register("event_date")} />
              <FieldError errors={[errors.event_date]} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={createTournament.isPending}>
              {createTournament.isPending && (
                <Loader2Icon data-icon="inline-start" className="animate-spin" />
              )}
              Create tournament
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
