"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const fields = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao hábito.").max(120),
    area_id: z.uuid(),
    folder_id: z.uuid().nullable(),
    frequency: z.enum(["daily", "weekdays", "times_per_week"]),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    times_per_week: z.number().int().min(1).max(7).nullable(),
    preferred_time: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable(),
    active: z.boolean(),
  })
  .partial();

export type HabitInput = z.input<typeof fields>;

function checkFrequency(data: HabitInput) {
  if (data.frequency === "weekdays" && (!data.weekdays || data.weekdays.length === 0)) {
    return "Escolha pelo menos um dia da semana.";
  }
  if (data.frequency === "times_per_week" && !data.times_per_week) return "Diga quantas vezes por semana.";
  return null;
}

export async function createHabit(input: HabitInput): Promise<ActionResult<Tables<"habits">>> {
  await getCurrentUser();
  const parsed = fields.required({ name: true, area_id: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const problem = checkFrequency(parsed.data);
  if (problem) return fail(problem);

  const supabase = await createClient();
  const { data, error } = await supabase.from("habits").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar o hábito.");

  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateHabit(habitId: string, patch: HabitInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = fields.safeParse(patch);
  if (!z.uuid().safeParse(habitId).success || !parsed.success) {
    return fail(parsed.error?.issues[0].message ?? "Hábito inválido.");
  }
  const problem = parsed.data.frequency ? checkFrequency(parsed.data) : null;
  if (problem) return fail(problem);

  const supabase = await createClient();
  const { error } = await supabase.from("habits").update(parsed.data).eq("id", habitId);
  if (error) return fail("Não foi possível salvar o hábito.");

  revalidatePath("/", "layout");
  return ok();
}

export async function trashHabit(habitId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!z.uuid().safeParse(habitId).success) return fail("Hábito inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("habits").update({ deleted_at: new Date().toISOString() }).eq("id", habitId);
  if (error) return fail("Não foi possível excluir o hábito.");

  revalidatePath("/", "layout");
  return ok();
}

// Marca ou desmarca o hábito num dia.
export async function setHabitDone(habitId: string, date: string, done: boolean): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = z
    .object({ habitId: z.uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    .safeParse({ habitId, date });
  if (!parsed.success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = done
    ? await supabase.from("habit_logs").upsert({ habit_id: habitId, date, done: true }, { onConflict: "habit_id,date" })
    : await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("date", date);
  if (error) return fail("Não foi possível salvar a marcação.");

  // Sem revalidate: a tela já mostrou a mudança e nada mais depende disso agora.
  return ok();
}
