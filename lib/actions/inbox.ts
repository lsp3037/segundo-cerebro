"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { CONVERT_TARGETS } from "@/lib/inbox";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const URL_ONLY = /^https?:\/\/\S+$/i;

export async function captureInbox(content: string): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const text = z.string().trim().min(1, "Escreva alguma coisa.").max(10_000).safeParse(content);
  if (!text.success) return fail(text.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inbox_items")
    .insert({ content: text.data, url: URL_ONLY.test(text.data) ? text.data : null, source: "web" })
    .select("id")
    .single();
  if (error) return fail("Não foi possível guardar na Caixa de Entrada.");

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

const convertSchema = z.object({
  target: z.enum(CONVERT_TARGETS),
  title: z.string().trim().min(1, "Dê um título.").max(300),
  area_id: z.uuid(),
  folder_id: z.uuid().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  keepContent: z.boolean(),
});

// Transforma o item em tarefa, nota, ideia, ideia de conteúdo ou aprendizado e o marca como processado.
export async function convertInboxItem(
  itemId: string,
  input: z.input<typeof convertSchema>,
): Promise<ActionResult<{ href: string }>> {
  await getCurrentUser();
  const parsed = convertSchema.safeParse(input);
  if (!z.uuid().safeParse(itemId).success || !parsed.success) {
    return fail(parsed.error?.issues[0].message ?? "Item inválido.");
  }
  const { target, title, area_id, folder_id, due_date, keepContent } = parsed.data;

  const supabase = await createClient();
  const { data: item } = await supabase.from("inbox_items").select("*").eq("id", itemId).single();
  if (!item) return fail("Item não encontrado.");

  // O texto original vai junto como corpo/notas, a menos que seja igual ao título.
  const body = keepContent && item.content.trim() !== title ? item.content : null;

  let created: { id: string } | null = null;
  let href = "/";
  switch (target) {
    case "task": {
      const r = await supabase.from("tasks").insert({ title, area_id, folder_id, due_date, notes: body }).select("id").single();
      created = r.data;
      href = folder_id ? `/p/${folder_id}` : "/hoje?v=lista";
      break;
    }
    case "note": {
      const r = await supabase
        .from("notes")
        .insert({ title, area_id, folder_id, content_md: body, content_text: body })
        .select("id")
        .single();
      created = r.data;
      href = r.data ? `/conhecimento/${r.data.id}` : "/conhecimento";
      break;
    }
    case "idea": {
      const r = await supabase.from("ideas").insert({ title, area_id, folder_id, notes: body }).select("id").single();
      created = r.data;
      href = "/ideias";
      break;
    }
    case "content_idea": {
      const r = await supabase.from("content_ideas").insert({ title, folder_id, notes: body }).select("id").single();
      created = r.data;
      href = folder_id ? `/p/${folder_id}` : "/ideias";
      break;
    }
    case "learning_item": {
      const r = await supabase
        .from("learning_items")
        .insert({ topic: title, area_id, folder_id, reason: body })
        .select("id")
        .single();
      created = r.data;
      href = "/aprender";
      break;
    }
  }
  if (!created) return fail("Não foi possível criar o item.");

  await supabase
    .from("inbox_items")
    .update({ status: "processed", converted_to_type: target, converted_to_id: created.id })
    .eq("id", itemId);

  revalidatePath("/", "layout");
  return ok({ href });
}

export async function setInboxStatus(itemId: string, status: "new" | "archived"): Promise<ActionResult> {
  await getCurrentUser();
  if (!z.uuid().safeParse(itemId).success) return fail("Item inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("inbox_items").update({ status }).eq("id", itemId);
  if (error) return fail("Não foi possível atualizar o item.");

  revalidatePath("/", "layout");
  return ok();
}

export async function trashInboxItem(itemId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!z.uuid().safeParse(itemId).success) return fail("Item inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("inbox_items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return fail("Não foi possível excluir o item.");

  revalidatePath("/", "layout");
  return ok();
}
