"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

export type SearchHit = {
  kind: "task" | "note" | "idea" | "learning" | "inbox";
  id: string;
  title: string;
  snippet: string | null;
  area_id: string | null;
};

// Busca textual (Ctrl+K) nas tabelas de conteúdo. O RLS garante que só volta o que é seu.
export async function searchContent(query: string): Promise<ActionResult<SearchHit[]>> {
  await getCurrentUser();
  const q = z.string().trim().min(2).max(200).safeParse(query);
  if (!q.success) return ok([]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_all", { q: q.data, max_results: 15 });
  if (error) return fail("A busca falhou. Tente de novo.");

  return ok(
    (data ?? []).map((r) => ({
      kind: r.kind as SearchHit["kind"],
      id: r.id,
      title: r.title,
      snippet: r.snippet,
      area_id: r.area_id,
    })),
  );
}
