"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();
const link = z.object({ title: z.string().trim().max(200), url: z.url("Link inválido.").max(2000) });
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Cor inválida.");

// ---------------------------------------------------------------------------
// Pilares de conteúdo
// ---------------------------------------------------------------------------

const pillarFields = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao pilar.").max(80),
    color: hexColor.nullable(),
    description: z.string().trim().max(500).nullable(),
    sort_order: z.number().int(),
  })
  .partial();

export type PillarInput = z.input<typeof pillarFields>;

export async function createPillar(input: PillarInput): Promise<ActionResult<Tables<"content_pillars">>> {
  await getCurrentUser();
  const parsed = pillarFields.required({ name: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_pillars").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar o pilar.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updatePillar(pillarId: string, patch: PillarInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = pillarFields.safeParse(patch);
  if (!id.safeParse(pillarId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("content_pillars").update(parsed.data).eq("id", pillarId);
  if (error) return fail("Não foi possível salvar o pilar.");
  revalidatePath("/", "layout");
  return ok();
}

// Pilar não tem lixeira: as ideias dele ficam "sem pilar".
export async function deletePillar(pillarId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(pillarId).success) return fail("Pilar inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("content_pillars").delete().eq("id", pillarId);
  if (error) return fail("Não foi possível excluir o pilar.");
  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Ideias de conteúdo
// ---------------------------------------------------------------------------

const ideaFields = z
  .object({
    title: z.string().trim().min(1, "Escreva a ideia.").max(300),
    format: z.enum(["reel", "carousel", "post", "story"]).nullable(),
    pillar_id: id.nullable(),
    status: z.enum(["idea", "developing", "approved", "discarded"]),
    notes: z.string().max(20_000).nullable(),
    references: z.array(link).max(50),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    folder_id: id.nullable(),
  })
  .partial();

export type ContentIdeaInput = z.input<typeof ideaFields>;

export async function createContentIdea(input: ContentIdeaInput): Promise<ActionResult<Tables<"content_ideas">>> {
  await getCurrentUser();
  const parsed = ideaFields.required({ title: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_ideas").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar a ideia.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateContentIdea(ideaId: string, patch: ContentIdeaInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = ideaFields.safeParse(patch);
  if (!id.safeParse(ideaId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const data = { ...parsed.data };
  if (data.tags) data.tags = [...new Set(data.tags.map((t) => t.toLowerCase()))];

  const supabase = await createClient();
  const { error } = await supabase.from("content_ideas").update(data).eq("id", ideaId);
  if (error) return fail("Não foi possível salvar a ideia.");
  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Publicações (calendário editorial)
// ---------------------------------------------------------------------------

const publicationFields = z
  .object({
    content_idea_id: id.nullable(),
    channel: z.enum(["instagram", "google_business"]),
    scheduled_for: z.iso.datetime({ offset: true }).nullable(),
    caption: z.string().max(5000).nullable(),
    status: z.enum(["idea", "script", "production", "scheduled", "published"]),
    published_url: z.url("Link inválido.").max(2000).nullable(),
    notes: z.string().max(20_000).nullable(),
  })
  .partial();

export type PublicationInput = z.input<typeof publicationFields>;

export async function createPublication(input: PublicationInput): Promise<ActionResult<Tables<"publications">>> {
  await getCurrentUser();
  const parsed = publicationFields.required({ channel: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("publications").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar a publicação.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updatePublication(publicationId: string, patch: PublicationInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = publicationFields.safeParse(patch);
  if (!id.safeParse(publicationId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("publications").update(parsed.data).eq("id", publicationId);
  if (error) return fail("Não foi possível salvar a publicação.");
  revalidatePath("/", "layout");
  return ok();
}

// Lixeira para ideias de conteúdo e publicações.
export async function trashContent(kind: "content_ideas" | "publications", itemId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(itemId).success || !["content_ideas", "publications"].includes(kind)) return fail("Item inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from(kind).update({ deleted_at: new Date().toISOString() }).eq("id", itemId);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/", "layout");
  return ok();
}
