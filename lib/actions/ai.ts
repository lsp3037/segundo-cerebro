"use server";

import { z } from "zod";

import { AiNotConfiguredError, getAiProvider } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { CONVERT_TARGETS, type ConvertTarget, TARGETS } from "@/lib/inbox";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

export type InboxSuggestion = { target: ConvertTarget; areaId: string; folderId: string | null; title: string };

// "Sugerir classificação": o texto do item vai para a IA, que propõe tipo, área, pasta e título.
// Só roda quando o usuário clica; a tela avisa que o texto sai do sistema.
export async function suggestInboxClassification(itemId: string): Promise<ActionResult<InboxSuggestion>> {
  await getCurrentUser();
  if (!z.uuid().safeParse(itemId).success) return fail("Item inválido.");

  const supabase = await createClient();
  const [{ data: item }, { data: areas }, { data: folders }] = await Promise.all([
    supabase.from("inbox_items").select("content").eq("id", itemId).single(),
    supabase.from("areas").select("id, slug, name"),
    supabase.from("folders").select("id, name, area_id, module").is("deleted_at", null),
  ]);
  if (!item || !areas || !folders) return fail("Item não encontrado.");

  const options = folders
    .map((f) => {
      const area = areas.find((a) => a.id === f.area_id);
      return `- ${f.id}: ${area?.name} › ${f.name} (${f.module})`;
    })
    .join("\n");

  try {
    const ai = getAiProvider();
    const answer = await ai.generateJson<{ target: ConvertTarget; area_slug: string; folder_id: string | null; title: string }>({
      system:
        "Você organiza a Caixa de Entrada de um sistema pessoal. Classifique o item em um destino, uma área e, se fizer sentido, uma pasta. " +
        "Responda em português do Brasil. O título deve ser curto (até 80 caracteres) e começar com verbo quando for tarefa.",
      prompt: [
        `Destinos: ${CONVERT_TARGETS.map((t) => `${t} (${TARGETS[t].label})`).join(", ")}.`,
        `Áreas: ${areas.map((a) => `${a.slug} (${a.name})`).join(", ")}.`,
        `Pastas disponíveis (id: área › pasta (tipo)):\n${options}`,
        `Item:\n"""${item.content.slice(0, 4000)}"""`,
      ].join("\n\n"),
      schema: {
        type: "object",
        properties: {
          target: { type: "string", enum: [...CONVERT_TARGETS] },
          area_slug: { type: "string", enum: areas.map((a) => a.slug) },
          folder_id: { type: ["string", "null"] },
          title: { type: "string" },
        },
        required: ["target", "area_slug", "folder_id", "title"],
      },
    });

    const area = areas.find((a) => a.slug === answer.area_slug) ?? areas[0];
    const folder = folders.find((f) => f.id === answer.folder_id && f.area_id === area.id);
    return ok({
      target: CONVERT_TARGETS.includes(answer.target) ? answer.target : "task",
      areaId: area.id,
      folderId: folder?.id ?? null,
      title: answer.title.slice(0, 300),
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail(error.message);
    console.error("suggestInboxClassification", error);
    return fail("A IA não conseguiu sugerir agora. Tente de novo em instantes.");
  }
}
