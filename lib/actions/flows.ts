"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { slugify, SUGGESTED_FLOWS } from "@/lib/service-flows";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();
const line = z.string().trim().min(1).max(1000);
const lines = z.array(line).max(50);

const flowFields = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao fluxo.").max(120),
    description: z.string().trim().max(1000).nullable(),
    steps: lines,
    questions: lines,
    info_to_collect: lines,
    message_templates: z.array(z.object({ title: z.string().trim().max(120), text: z.string().trim().min(1).max(3000) })).max(50),
    objections: z.array(z.object({ objection: line, answer: z.string().trim().max(3000) })).max(50),
    next_steps: lines,
    active: z.boolean(),
  })
  .partial();

export type FlowInput = z.input<typeof flowFields>;

export async function createFlow(input: FlowInput): Promise<ActionResult<Tables<"service_flows">>> {
  await getCurrentUser();
  const parsed = flowFields.required({ name: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const base = slugify(parsed.data.name) || "fluxo";
  // O slug é único por usuário: acrescenta um número se já existir.
  const { data: taken } = await supabase.from("service_flows").select("slug").like("slug", `${base}%`);
  const used = new Set((taken ?? []).map((t) => t.slug));
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await supabase
    .from("service_flows")
    .insert({ ...parsed.data, slug })
    .select("*")
    .single();
  if (error) return fail("Não foi possível criar o fluxo.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateFlow(flowId: string, patch: FlowInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = flowFields.safeParse(patch);
  if (!id.safeParse(flowId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("service_flows").update(parsed.data).eq("id", flowId);
  if (error) return fail("Não foi possível salvar o fluxo.");
  revalidatePath("/", "layout");
  return ok();
}

export async function trashFlow(flowId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(flowId).success) return fail("Fluxo inválido.");

  const supabase = await createClient();
  // Libera o slug para um fluxo novo com o mesmo nome.
  const { error } = await supabase
    .from("service_flows")
    .update({ deleted_at: new Date().toISOString(), slug: `excluido-${flowId}`, active: false })
    .eq("id", flowId);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/", "layout");
  return ok();
}

export async function createSuggestedFlows(): Promise<ActionResult<Tables<"service_flows">[]>> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("service_flows")
    .upsert(
      SUGGESTED_FLOWS.map((f) => ({ ...f, slug: slugify(f.name) })),
      { onConflict: "user_id,slug", ignoreDuplicates: true },
    )
    .select("*");
  if (error) return fail("Não foi possível criar os fluxos.");
  revalidatePath("/", "layout");
  return ok(data);
}
