"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { formatLongDate } from "@/lib/dates";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();

// Modelo de nota de reunião (vira blocos do editor na primeira abertura).
function meetingTemplate() {
  return [
    `**Data:** ${formatLongDate(new Date())}`,
    "",
    "**Participantes:** ",
    "",
    "## Pauta",
    "",
    "- ",
    "",
    "## Decisões",
    "",
    "- ",
    "",
    "## Encaminhamentos",
    "",
    "- [ ] ",
  ].join("\n");
}

export async function createNote(input: {
  area_id: string;
  folder_id: string | null;
  template?: "meeting" | null;
  title?: string;
}): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = z
    .object({
      area_id: id,
      folder_id: id.nullable(),
      template: z.enum(["meeting"]).nullable().optional(),
      title: z.string().trim().max(300).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return fail("Dados inválidos.");

  const meeting = parsed.data.template === "meeting";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      area_id: parsed.data.area_id,
      folder_id: parsed.data.folder_id,
      title: parsed.data.title || (meeting ? `Reunião — ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Cuiaba" })}` : "Sem título"),
      template: meeting ? "meeting" : null,
      content_md: meeting ? meetingTemplate() : null,
    })
    .select("id")
    .single();
  if (error) return fail("Não foi possível criar a nota.");

  revalidatePath("/conhecimento");
  return ok({ id: data.id });
}

const NOTE_LINK = /\/conhecimento\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

// Salvamento automático do conteúdo. Também atualiza a lista de "notas que apontam para esta".
export async function saveNoteContent(
  noteId: string,
  content: { json: unknown; markdown: string; text: string },
): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(noteId).success) return fail("Nota inválida.");
  if (content.markdown.length > 1_000_000) return fail("A nota ficou grande demais para salvar.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ content_json: content.json as Json, content_md: content.markdown, content_text: content.text })
    .eq("id", noteId);
  if (error) return fail("Não foi possível salvar a nota.");

  const targets = [...new Set([...content.markdown.matchAll(NOTE_LINK)].map((m) => m[1].toLowerCase()))].filter(
    (t) => t !== noteId,
  );
  // Só vale link para nota que existe (o RLS já esconde as que não são suas).
  const { data: existing } = targets.length
    ? await supabase.from("notes").select("id").in("id", targets)
    : { data: [] as { id: string }[] };
  await supabase.from("note_links").delete().eq("from_note_id", noteId);
  if (existing && existing.length > 0) {
    await supabase.from("note_links").insert(existing.map((n) => ({ from_note_id: noteId, to_note_id: n.id })));
  }

  return ok();
}

const metaSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    area_id: id,
    folder_id: id.nullable(),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    pinned: z.boolean(),
  })
  .partial();

export async function updateNoteMeta(noteId: string, patch: z.input<typeof metaSchema>): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = metaSchema.safeParse(patch);
  if (!id.safeParse(noteId).success || !parsed.success) return fail("Dados inválidos.");

  const data = { ...parsed.data };
  if (data.tags) data.tags = [...new Set(data.tags.map((t) => t.toLowerCase()))];

  const supabase = await createClient();
  const { error } = await supabase.from("notes").update(data).eq("id", noteId);
  if (error) return fail("Não foi possível salvar.");

  revalidatePath("/conhecimento");
  return ok();
}

export async function trashNote(noteId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(noteId).success) return fail("Nota inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ deleted_at: new Date().toISOString() }).eq("id", noteId);
  if (error) return fail("Não foi possível excluir a nota.");

  revalidatePath("/", "layout");
  return ok();
}
