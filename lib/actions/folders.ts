"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { FOLDER_MODULES } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const name = z.string().trim().min(1, "Dê um nome à pasta.").max(80, "Nome muito longo (máx. 80).");
const id = z.uuid();

const createSchema = z.object({
  areaId: id,
  parentId: id.nullable(),
  name,
  module: z.enum(FOLDER_MODULES).optional(),
});

export async function createFolder(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { areaId, parentId } = parsed.data;
  const supabase = await createClient();

  // Subpasta herda área e tipo da pasta-mãe.
  let folderModule = parsed.data.module;
  let area = areaId;
  if (parentId) {
    const { data: parent } = await supabase.from("folders").select("area_id, module").eq("id", parentId).single();
    if (!parent) return fail("Pasta-mãe não encontrada.");
    folderModule = parent.module as (typeof FOLDER_MODULES)[number];
    area = parent.area_id;
  }
  if (!folderModule) return fail("Escolha o tipo da pasta.");

  const siblings = supabase.from("folders").select("sort_order").eq("area_id", area).is("deleted_at", null);
  const { data: last } = await (parentId ? siblings.eq("parent_id", parentId) : siblings.is("parent_id", null))
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("folders")
    .insert({ area_id: area, parent_id: parentId, name: parsed.data.name, module: folderModule, sort_order: (last?.sort_order ?? -1) + 1 })
    .select("id")
    .single();
  if (error) return fail("Não foi possível criar a pasta.");

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

export async function renameFolder(folderId: string, newName: string): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = z.object({ folderId: id, newName: name }).safeParse({ folderId, newName });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { error } = await supabase.from("folders").update({ name: parsed.data.newName }).eq("id", folderId);
  if (error) return fail("Não foi possível renomear.");

  revalidatePath("/", "layout");
  return ok();
}

// Recebe os ids de pastas-irmãs na nova ordem.
export async function reorderFolders(orderedIds: string[]): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = z.array(id).min(1).max(200).safeParse(orderedIds);
  if (!parsed.success) return fail("Ordem inválida.");

  const supabase = await createClient();
  const results = await Promise.all(
    parsed.data.map((folderId, index) => supabase.from("folders").update({ sort_order: index }).eq("id", folderId)),
  );
  if (results.some((r) => r.error)) return fail("Não foi possível salvar a nova ordem.");

  revalidatePath("/", "layout");
  return ok();
}

export async function setFolderCollapsed(folderId: string, collapsed: boolean): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(folderId).success) return fail("Pasta inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("folders").update({ collapsed }).eq("id", folderId);
  return error ? fail("Não foi possível salvar.") : ok();
}

// Move a pasta (e tudo dentro dela) para outra pasta-mãe ou para a raiz de uma área.
export async function moveFolder(folderId: string, target: { areaId: string; parentId: string | null }): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = z
    .object({ folderId: id, areaId: id, parentId: id.nullable() })
    .safeParse({ folderId, ...target });
  if (!parsed.success) return fail("Destino inválido.");

  const supabase = await createClient();
  const { data: all } = await supabase.from("folders").select("id, parent_id, area_id, module").is("deleted_at", null);
  if (!all) return fail("Não foi possível carregar as pastas.");

  const subtree = collectSubtree(all, folderId);
  if (target.parentId && subtree.includes(target.parentId)) {
    return fail("Não dá para mover uma pasta para dentro dela mesma.");
  }
  const parent = target.parentId ? all.find((f) => f.id === target.parentId) : null;
  if (target.parentId && !parent) return fail("Destino não encontrado.");
  const areaId = parent?.area_id ?? target.areaId;

  const { data: last } = await (target.parentId
    ? supabase.from("folders").select("sort_order").eq("parent_id", target.parentId)
    : supabase.from("folders").select("sort_order").eq("area_id", areaId).is("parent_id", null)
  )
    .is("deleted_at", null)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const moved = await supabase
    .from("folders")
    .update({ parent_id: target.parentId, area_id: areaId, sort_order: (last?.sort_order ?? -1) + 1 })
    .eq("id", folderId);
  const areaFix = await supabase.from("folders").update({ area_id: areaId }).in("id", subtree);
  if (moved.error || areaFix.error) return fail("Não foi possível mover a pasta.");

  revalidatePath("/", "layout");
  return ok();
}

// Manda a pasta e as subpastas para a lixeira. Os itens dentro delas não são apagados.
export async function trashFolder(folderId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(folderId).success) return fail("Pasta inválida.");

  const supabase = await createClient();
  const { data: all } = await supabase.from("folders").select("id, parent_id").is("deleted_at", null);
  if (!all) return fail("Não foi possível carregar as pastas.");

  const { error } = await supabase
    .from("folders")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", collectSubtree(all, folderId));
  if (error) return fail("Não foi possível excluir a pasta.");

  revalidatePath("/", "layout");
  return ok();
}

// Tira da lixeira a pasta e as subpastas que foram excluídas junto com ela.
export async function restoreFolder(folderId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(folderId).success) return fail("Pasta inválida.");

  const supabase = await createClient();
  const { data: all } = await supabase.from("folders").select("id, parent_id, deleted_at");
  const folder = all?.find((f) => f.id === folderId);
  if (!all || !folder?.deleted_at) return fail("Pasta não encontrada na lixeira.");

  const sameBatch = all.filter((f) => f.deleted_at === folder.deleted_at);
  const ids = collectSubtree(sameBatch, folderId);

  // Se a pasta-mãe continua na lixeira, a pasta volta para a raiz da área.
  const parent = all.find((f) => f.id === folder.parent_id);
  const backToRoot = parent?.deleted_at ? { parent_id: null } : {};

  const restored = await supabase.from("folders").update({ deleted_at: null }).in("id", ids);
  const rooted = Object.keys(backToRoot).length
    ? await supabase.from("folders").update(backToRoot).eq("id", folderId)
    : { error: null };
  if (restored.error || rooted.error) return fail("Não foi possível restaurar.");

  revalidatePath("/", "layout");
  return ok();
}

function collectSubtree(folders: { id: string; parent_id: string | null }[], rootId: string): string[] {
  const ids = [rootId];
  for (let i = 0; i < ids.length; i++) {
    for (const f of folders) if (f.parent_id === ids[i]) ids.push(f.id);
  }
  return ids;
}
