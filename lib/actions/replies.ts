"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AiNotConfiguredError, getAiProvider } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import { maskPersonalData } from "@/lib/mask";
import type { MessageTemplate, Objection } from "@/lib/service-flows";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();
const TRUSTCARE_SLUG = "trustcare";
// Limites para caber no contexto do modelo e não mandar mais que o necessário.
const MAX_CONVERSATION = 8000;
const MAX_REPOSITORY = 12_000;

export type ReplySuggestion = {
  flow_slug: string | null;
  summary: string;
  replies: { label: string; text: string }[];
  next_step: string;
  missing_info: string[];
};

type ReplyCase = Tables<"reply_cases">;

const suggestInput = z.object({
  caseId: id.nullable(),
  label: z.string().trim().max(120).nullable(),
  conversation: z.string().trim().min(10, "Cole a conversa (pelo menos uma frase).").max(MAX_CONVERSATION, "Conversa muito longa: cole só a parte recente."),
  flowId: id.nullable(),
});

// Assistente de Respostas: a conversa (com dados pessoais escondidos) + o fluxo + o
// Repositório da Empresa vão para a IA, que devolve opções de resposta. Nada é enviado ao cliente.
export async function suggestReplies(input: z.input<typeof suggestInput>): Promise<ActionResult<ReplyCase>> {
  await getCurrentUser();
  const parsed = suggestInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { caseId, label, conversation, flowId } = parsed.data;

  const supabase = await createClient();
  const { data: area } = await supabase.from("areas").select("id").eq("slug", TRUSTCARE_SLUG).single();
  if (!area) return fail("Área Trust Care não encontrada.");
  try {
    await assertAreaAllowsAi(area.id);
  } catch (error) {
    return fail((error as Error).message);
  }

  const [{ data: flows }, { data: folders }] = await Promise.all([
    supabase.from("service_flows").select("*").is("deleted_at", null).eq("active", true).order("name"),
    supabase.from("folders").select("id").eq("area_id", area.id).eq("module", "notes").is("deleted_at", null),
  ]);
  const { data: notes } = folders?.length
    ? await supabase
        .from("notes")
        .select("title, content_text")
        .in("folder_id", folders.map((f) => f.id))
        .is("deleted_at", null)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
    : { data: [] };

  const chosen = flowId ? flows?.find((f) => f.id === flowId) : undefined;
  if (flowId && !chosen) return fail("Fluxo não encontrado ou pausado.");

  let repository = "";
  for (const n of notes ?? []) {
    const block = `### ${n.title}\n${n.content_text ?? ""}\n\n`;
    if (repository.length + block.length > MAX_REPOSITORY) break;
    repository += block;
  }

  const { masked } = maskPersonalData(conversation);
  const describeFlow = (f: Tables<"service_flows">) =>
    [
      `Fluxo "${f.name}" (${f.slug}): ${f.description ?? ""}`,
      `Etapas: ${(f.steps as string[]).join(" → ")}`,
      `Perguntas: ${(f.questions as string[]).join(" | ")}`,
      `Informações a coletar: ${(f.info_to_collect as string[]).join(" | ")}`,
      `Mensagens-modelo: ${(f.message_templates as MessageTemplate[]).map((m) => `[${m.title}] ${m.text}`).join(" | ")}`,
      `Objeções: ${(f.objections as Objection[]).map((o) => `"${o.objection}" → ${o.answer}`).join(" | ")}`,
      `Próximos passos: ${(f.next_steps as string[]).join(" | ")}`,
    ].join("\n");

  const flowContext = chosen
    ? describeFlow(chosen)
    : (flows ?? []).map((f) => `- ${f.slug}: ${f.name}. ${f.description ?? ""}`).join("\n");

  let suggestion: ReplySuggestion;
  try {
    const ai = getAiProvider();
    suggestion = await ai.generateJson<ReplySuggestion>({
      system: [
        "Você ajuda o Luan, dono da Trust Care (manutenção de computadores, upgrades e revenda de notebooks em Cuiabá-MT), a responder leads e clientes no WhatsApp.",
        "Escreva em português do Brasil, em primeira pessoa, como o próprio Luan: tom humano, direto, cordial, sem cara de propaganda, sem emojis em excesso.",
        "Mensagens curtas, de WhatsApp. Não invente preços, prazos ou políticas que não estejam no Repositório da Empresa; se faltar, sugira perguntar ou combinar depois.",
        "Dados pessoais aparecem mascarados como [TELEFONE], [EMAIL] etc.; nunca tente adivinhá-los e não os inclua nas respostas.",
        "Devolva de 2 a 3 opções de resposta com abordagens diferentes, o próximo passo recomendado no funil e o que ainda falta perguntar.",
      ].join(" "),
      prompt: [
        chosen ? `Fluxo escolhido pelo Luan:\n${flowContext}` : `Fluxos disponíveis (identifique o mais adequado pelo slug, ou null se nenhum servir):\n${flowContext || "(nenhum)"}`,
        repository ? `Repositório da Empresa:\n${repository}` : "Repositório da Empresa: (vazio)",
        `Conversa com o cliente:\n"""${masked}"""`,
      ].join("\n\n"),
      schema: {
        type: "object",
        properties: {
          flow_slug: { type: ["string", "null"] },
          summary: { type: "string", description: "O que o cliente quer, em uma frase." },
          replies: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "object",
              properties: { label: { type: "string", description: "Abordagem em 2-4 palavras" }, text: { type: "string" } },
              required: ["label", "text"],
            },
          },
          next_step: { type: "string" },
          missing_info: { type: "array", items: { type: "string" } },
        },
        required: ["flow_slug", "summary", "replies", "next_step", "missing_info"],
      },
    });
  } catch (error) {
    if (error instanceof AiNotConfiguredError) return fail(error.message);
    console.error("suggestReplies", error);
    return fail("A IA não conseguiu responder agora. Tente de novo em instantes.");
  }

  const detected = chosen ?? flows?.find((f) => f.slug === suggestion.flow_slug);
  // O texto original fica só no banco; a IA recebeu a versão mascarada.
  const row = {
    label: label || suggestion.summary.slice(0, 120),
    conversation_text: conversation,
    service_flow_id: chosen?.id ?? null,
    detected_flow_id: chosen ? null : (detected?.id ?? null),
    ai_output: suggestion,
  };

  const { data, error } = caseId
    ? await supabase.from("reply_cases").update(row).eq("id", caseId).select("*").single()
    : await supabase.from("reply_cases").insert(row).select("*").single();
  if (error || !data) return fail("A sugestão veio, mas não foi possível salvar o caso.");
  revalidatePath("/", "layout");
  return ok(data);
}

const caseFields = z
  .object({
    label: z.string().trim().max(120).nullable(),
    chosen_reply: z.string().max(5000).nullable(),
    outcome: z.enum(["open", "won", "lost"]),
    outcome_notes: z.string().max(5000).nullable(),
  })
  .partial();

export type ReplyCaseInput = z.input<typeof caseFields>;

export async function updateReplyCase(caseId: string, patch: ReplyCaseInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = caseFields.safeParse(patch);
  if (!id.safeParse(caseId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("reply_cases").update(parsed.data).eq("id", caseId);
  if (error) return fail("Não foi possível salvar o caso.");
  revalidatePath("/", "layout");
  return ok();
}

export async function trashReplyCase(caseId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(caseId).success) return fail("Caso inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("reply_cases").update({ deleted_at: new Date().toISOString() }).eq("id", caseId);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/", "layout");
  return ok();
}
