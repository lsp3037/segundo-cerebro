"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Dê um nome à área.").max(60),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
    ai_enabled: z.boolean(),
    show_lgpd_notice: z.boolean(),
    collapsed: z.boolean(),
  })
  .partial();

export async function updateArea(areaId: string, patch: z.input<typeof patchSchema>): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = patchSchema.safeParse(patch);
  if (!z.uuid().safeParse(areaId).success || !parsed.success) {
    return fail(parsed.error?.issues[0].message ?? "Área inválida.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("areas").update(parsed.data).eq("id", areaId);
  if (error) return fail("Não foi possível salvar a área.");

  // Recolher/expandir não muda nada que precise ser recarregado.
  if (Object.keys(parsed.data).some((k) => k !== "collapsed")) revalidatePath("/", "layout");
  return ok();
}
