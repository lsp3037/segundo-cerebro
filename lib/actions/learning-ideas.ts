"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();
const link = z.object({ title: z.string().trim().max(200), url: z.url("Link inválido.").max(2000) });

// ---------------------------------------------------------------------------
// Aprender
// ---------------------------------------------------------------------------

const learningFields = z
  .object({
    topic: z.string().trim().min(1, "Escreva o tema.").max(300),
    reason: z.string().max(5000).nullable(),
    resources: z.array(link).max(50),
    status: z.enum(["wishlist", "learning", "paused", "done"]),
    progress: z.number().int().min(0).max(100),
    target_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    area_id: id,
    folder_id: id.nullable(),
  })
  .partial();

export type LearningInput = z.input<typeof learningFields>;

export async function createLearningItem(input: LearningInput): Promise<ActionResult<Tables<"learning_items">>> {
  await getCurrentUser();
  const parsed = learningFields.required({ topic: true, area_id: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("learning_items").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateLearningItem(itemId: string, patch: LearningInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = learningFields.safeParse(patch);
  if (!id.safeParse(itemId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const data = { ...parsed.data };
  if (data.status === "done") data.progress = 100;

  const supabase = await createClient();
  const { error } = await supabase.from("learning_items").update(data).eq("id", itemId);
  if (error) return fail("Não foi possível salvar.");
  revalidatePath("/", "layout");
  return ok();
}

// Transforma um aprendizado em nota no Conhecimento (tema, motivo e recursos).
export async function learningToNote(itemId: string): Promise<ActionResult<{ noteId: string }>> {
  await getCurrentUser();
  if (!id.safeParse(itemId).success) return fail("Item inválido.");

  const supabase = await createClient();
  const { data: item } = await supabase.from("learning_items").select("*").eq("id", itemId).single();
  if (!item) return fail("Item não encontrado.");
  if (item.note_id) return ok({ noteId: item.note_id });

  const resources = (item.resources as { title: string; url: string }[]) ?? [];
  const markdown = [
    item.reason ? `**Por que aprender:** ${item.reason}` : null,
    "## O que aprendi",
    "",
    "- ",
    resources.length ? "## Recursos" : null,
    ...resources.map((r) => `- [${r.title || r.url}](${r.url})`),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const { data: note, error } = await supabase
    .from("notes")
    .insert({ title: item.topic, area_id: item.area_id, content_md: markdown, content_text: markdown, tags: ["aprendizado"] })
    .select("id")
    .single();
  if (error || !note) return fail("Não foi possível criar a nota.");

  await supabase.from("learning_items").update({ note_id: note.id, status: "done", progress: 100 }).eq("id", itemId);
  revalidatePath("/", "layout");
  return ok({ noteId: note.id });
}

// ---------------------------------------------------------------------------
// Ideias gerais
// ---------------------------------------------------------------------------

const ideaFields = z
  .object({
    title: z.string().trim().min(1, "Escreva a ideia.").max(300),
    notes: z.string().max(20_000).nullable(),
    status: z.enum(["loose", "maturing", "project", "discarded"]),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    links: z.array(link).max(50),
    area_id: id,
    folder_id: id.nullable(),
  })
  .partial();

export type IdeaInput = z.input<typeof ideaFields>;

export async function createIdea(input: IdeaInput): Promise<ActionResult<Tables<"ideas">>> {
  await getCurrentUser();
  const parsed = ideaFields.required({ title: true, area_id: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("ideas").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar a ideia.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateIdea(ideaId: string, patch: IdeaInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = ideaFields.safeParse(patch);
  if (!id.safeParse(ideaId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const data = { ...parsed.data };
  if (data.tags) data.tags = [...new Set(data.tags.map((t) => t.toLowerCase()))];

  const supabase = await createClient();
  const { error } = await supabase.from("ideas").update(data).eq("id", ideaId);
  if (error) return fail("Não foi possível salvar a ideia.");
  revalidatePath("/", "layout");
  return ok();
}

// Lixeira genérica para os dois tipos.
export async function trashItem(kind: "learning_items" | "ideas", itemId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(itemId).success || !["learning_items", "ideas"].includes(kind)) return fail("Item inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from(kind).update({ deleted_at: new Date().toISOString() }).eq("id", itemId);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/", "layout");
  return ok();
}
