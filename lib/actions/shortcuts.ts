"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();

const shortcutFields = z
  .object({
    title: z.string().trim().min(1, "Dê um nome ao atalho.").max(120),
    url: z
      .string()
      .trim()
      .transform((v) => (/^https?:\/\//i.test(v) ? v : `https://${v}`))
      .pipe(z.url("Endereço inválido.").max(2000)),
    description: z.string().trim().max(300).nullable(),
    icon: z.string().max(40).nullable(),
    widget: z.enum(["os_summary"]).nullable(),
    folder_id: id.nullable(),
    sort_order: z.number().int(),
  })
  .partial();

export type ShortcutInput = z.input<typeof shortcutFields>;

export async function createShortcut(input: ShortcutInput): Promise<ActionResult<Tables<"shortcuts">>> {
  await getCurrentUser();
  const parsed = shortcutFields.required({ title: true, url: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("shortcuts").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar o atalho.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateShortcut(shortcutId: string, patch: ShortcutInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = shortcutFields.safeParse(patch);
  if (!id.safeParse(shortcutId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("shortcuts").update(parsed.data).eq("id", shortcutId);
  if (error) return fail("Não foi possível salvar o atalho.");
  revalidatePath("/", "layout");
  return ok();
}

export async function trashShortcut(shortcutId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(shortcutId).success) return fail("Atalho inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("shortcuts").update({ deleted_at: new Date().toISOString() }).eq("id", shortcutId);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/", "layout");
  return ok();
}

// Atalhos sugeridos pela especificação. O sistema de precificação fica para o Luan preencher.
const SUGGESTED = [
  { title: "Gerenciador de O.S.", url: "https://trustcare-one.vercel.app", icon: "wrench", widget: "os_summary" as const, description: "Ordens de serviço, clientes e orçamentos." },
  { title: "Agente de Marketing", url: "http://localhost:8007", icon: "megaphone", widget: null, description: "Painel de marketing (roda no PC)." },
  { title: "Loja online", url: "https://trustcare-site.vercel.app", icon: "store", widget: null, description: "Site da Trust Care." },
];

export async function createSuggestedShortcuts(folderId: string | null): Promise<ActionResult<Tables<"shortcuts">[]>> {
  await getCurrentUser();
  if (folderId !== null && !id.safeParse(folderId).success) return fail("Pasta inválida.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shortcuts")
    .insert(SUGGESTED.map((s, i) => ({ ...s, folder_id: folderId, sort_order: i })))
    .select("*");
  if (error) return fail("Não foi possível criar os atalhos.");
  revalidatePath("/", "layout");
  return ok(data);
}
