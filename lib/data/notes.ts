import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type Note = Tables<"notes">;
export type NoteSummary = Pick<
  Note,
  "id" | "title" | "area_id" | "folder_id" | "tags" | "pinned" | "template" | "updated_at" | "content_text"
>;

export async function getNotes(filter: { areaId?: string; folderIds?: string[] } = {}): Promise<NoteSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("notes")
    .select("id, title, area_id, folder_id, tags, pinned, template, updated_at, content_text")
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1000);
  if (filter.areaId) query = query.eq("area_id", filter.areaId);
  if (filter.folderIds) query = query.in("folder_id", filter.folderIds);

  const { data, error } = await query;
  if (error) throw error;
  // Só um trecho do texto vai para a lista.
  return data.map((n) => ({ ...n, content_text: n.content_text?.slice(0, 220) ?? null }));
}

export async function getNote(noteId: string) {
  const supabase = await createClient();
  const { data: note } = await supabase.from("notes").select("*").eq("id", noteId).is("deleted_at", null).maybeSingle();
  if (!note) return null;

  const [{ data: titles }, { data: backlinks }] = await Promise.all([
    supabase.from("notes").select("id, title").is("deleted_at", null).neq("id", noteId).order("updated_at", { ascending: false }).limit(1000),
    supabase.from("note_links").select("from_note_id, notes!note_links_from_note_id_fkey(id, title, deleted_at)").eq("to_note_id", noteId),
  ]);

  return {
    note,
    otherNotes: titles ?? [],
    backlinks: (backlinks ?? [])
      .map((l) => l.notes)
      .filter((n): n is { id: string; title: string; deleted_at: string | null } => Boolean(n) && !n!.deleted_at),
  };
}
