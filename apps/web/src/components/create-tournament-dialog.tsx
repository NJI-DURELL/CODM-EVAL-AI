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
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";

// Placements beyond #10 aren't asked for individually — organizers can widen
// this later if a tournament needs it, but every one seen so far pays out at
// most the top 10.
const PLACEMENT_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
// Sensible starting values so the field isn't a blank slate — every value
// stays fully editable since the points system genuinely varies per
// tournament (that's the whole point of asking instead of hardcoding it).
const DEFAULT_PLACEMENT_POINTS: Record<number, number> = {
  1: 10,
  2: 8,
  3: 7,
  4: 6,
  5: 5,
  6: 4,
  7: 3,
  8: 2,
  9: 1,
  10: 1,
};
const DEFAULT_KILL_POINT_VALUE = 1;

const placementPoints = z.coerce.number().min(0, "Must be 0 or higher");
const schema = z.object({
  name: z.string().min(2, "Give it a name (2+ characters)."),
  event_date: z.string().optional(),
  kill_point_value: z.coerce.number().min(0, "Must be 0 or higher"),
  placement_1: placementPoints,
  placement_2: placementPoints,
  placement_3: placementPoints,
  placement_4: placementPoints,
  placement_5: placementPoints,
  placement_6: placementPoints,
  placement_7: placementPoints,
  placement_8: placementPoints,
  placement_9: placementPoints,
  placement_10: placementPoints,
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function CreateTournamentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const createTournament = useCreateTournament();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      kill_point_value: DEFAULT_KILL_POINT_VALUE,
      ...Object.fromEntries(
        PLACEMENT_SLOTS.map((place) => [`placement_${place}`, DEFAULT_PLACEMENT_POINTS[place]])
      ),
    } as Partial<FormInput>,
  });

  async function onSubmit(values: FormOutput) {
    try {
      const placement_points = Object.fromEntries(
        PLACEMENT_SLOTS.map((place) => [String(place), values[`placement_${place}`]])
      );
      const tournament = await createTournament.mutateAsync({
        name: values.name,
        event_date: values.event_date || null,
        kill_point_value: values.kill_point_value,
        placement_points,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New tournament</DialogTitle>
          <DialogDescription>
            Set how points are scored for this tournament — every event pays out differently, so
            nothing here is locked in from a template.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
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

          <FieldSeparator />

          <FieldGroup>
            <Field data-invalid={!!errors.kill_point_value}>
              <FieldLabel htmlFor="kill_point_value">Points per kill</FieldLabel>
              <Input
                id="kill_point_value"
                type="number"
                step="0.1"
                min={0}
                aria-invalid={!!errors.kill_point_value}
                {...register("kill_point_value")}
              />
              <FieldError errors={[errors.kill_point_value]} />
            </Field>
            <Field>
              <FieldLabel>Placement points</FieldLabel>
              <div className="grid grid-cols-5 gap-2">
                {PLACEMENT_SLOTS.map((place) => {
                  const key = `placement_${place}` as const;
                  return (
                    <div key={place} className="flex flex-col gap-1">
                      <label htmlFor={key} className="text-xs text-muted-foreground">
                        #{place}
                      </label>
                      <Input
                        id={key}
                        type="number"
                        step="1"
                        min={0}
                        aria-invalid={!!errors[key]}
                        {...register(key)}
                      />
                    </div>
                  );
                })}
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter className="mt-2">
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
