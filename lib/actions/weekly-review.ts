"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const saveReviewSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de início da semana inválida"),
  checklist: z.record(z.string(), z.boolean()),
  notes: z.string().trim().max(5000).nullable().optional(),
  completed: z.boolean().default(false),
});

export type SaveWeeklyReviewInput = z.infer<typeof saveReviewSchema>;

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function saveWeeklyReviewAction(
  input: SaveWeeklyReviewInput,
): Promise<ActionResult<Tables<"weekly_reviews">>> {
  const user = await getCurrentUser();
  const parsed = saveReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();

  const nowIso = new Date().toISOString();
  const completedAt = parsed.data.completed ? nowIso : null;

  const { data, error } = await supabase
    .from("weekly_reviews")
    .upsert(
      {
        user_id: user.id,
        week_start: parsed.data.week_start,
        checklist: parsed.data.checklist,
        notes: parsed.data.notes ?? null,
        completed_at: completedAt,
        updated_at: nowIso,
      },
      { onConflict: "user_id, week_start" },
    )
    .select("*")
    .single();

  if (error || !data) {
    console.error("saveWeeklyReviewAction error:", error);
    return { ok: false, error: "Não foi possível salvar a revisão semanal." };
  }

  revalidatePath("/revisao");
  return { ok: true, data };
}
