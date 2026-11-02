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

const imagePartSchema = z.object({
  mimeType: z.string().min(1),
  base64Data: z.string().min(1),
});

const suggestInput = z
  .object({
    caseId: id.nullable().default(null),
    label: z.string().trim().max(120).nullable().default(null),
    conversation: z.string().trim().max(MAX_CONVERSATION, "Conversa muito longa: cole só a parte recente.").default(""),
    flowId: id.nullable().default(null),
    images: z.array(imagePartSchema).default([]),
    screenshotPaths: z.array(z.string()).default([]),
  })
  .refine(
    (data) => data.conversation.length >= 3 || data.images.length > 0 || data.screenshotPaths.length > 0,
    {
      message: "Envie um print da conversa ou digite o texto para a IA analisar.",
      path: ["conversation"],
    },
  );

// Assistente de Respostas: a conversa ou prints de tela + o fluxo + o
// Repositório da Empresa vão para a IA, que devolve opções de resposta. Nada é enviado ao cliente.
export async function suggestReplies(input: z.input<typeof suggestInput>): Promise<ActionResult<ReplyCase>> {
  await getCurrentUser();
  const parsed = suggestInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { caseId, label, conversation, flowId, images, screenshotPaths } = parsed.data;

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

  const promptSections: string[] = [
    chosen
      ? `Fluxo escolhido pelo Luan:\n${flowContext}`
      : `Fluxos disponíveis (identifique o mais adequado pelo slug, ou null se nenhum servir):\n${flowContext || "(nenhum)"}`,
    repository ? `Repositório da Empresa (Preços, regras, serviços e garantia da Trust Care):\n${repository}` : "Repositório da Empresa: (vazio)",
  ];

  if (images && images.length > 0) {
    promptSections.push(
      `Foram anexadas ${images.length} imagem(ns) / print(s) de conversa do WhatsApp. Analise a imagem com atenção: leia as mensagens trocadas, veja a dúvida ou sintoma relatado pelo cliente (ex.: marca/modelo, lentidão, tela quebrada, formatação, upgrade, orçamento) e elabore as respostas com base nisso.`
    );
  }

  if (conversation.trim()) {
    promptSections.push(`Texto ou notas adicionais fornecidas pelo Luan:\n"""${masked}"""`);
  } else if (images && images.length > 0) {
    promptSections.push("Identifique a conversa e o que o cliente quer exclusivamente a partir dos prints enviados.");
  }

  let suggestion: ReplySuggestion;
  try {
    const ai = getAiProvider();
    suggestion = await ai.generateJson<ReplySuggestion>({
      system: [
        "Você ajuda o Luan, dono da Trust Care (assistência técnica de computadores/notebooks, upgrades e revenda de notebooks em Cuiabá-MT), a responder leads e clientes no WhatsApp.",
        "Analise cuidadosamente a dúvida ou conversa com o cliente (seja em texto ou em prints do WhatsApp anexados).",
        "Escreva em português do Brasil, em primeira pessoa, como o próprio Luan: tom humano, direto, cordial, acolhedor, sem cara de propaganda, sem emojis em excesso.",
        "Mensagens curtas, de WhatsApp, prontas para enviar. Não invente preços fixos, prazos ou garantias que não constem no Repositório da Empresa; se faltar informação, sugira perguntar ao cliente ou estimar com cautela.",
        "Dados pessoais: não inclua telefones ou CPF nas respostas sugeridas.",
        "Devolva de 2 a 3 opções de resposta com abordagens complementares (ex.: direta, consultiva/explicativa, ou orientando diagnóstico), o próximo passo recomendado no funil e o que ainda falta perguntar.",
      ].join(" "),
      prompt: promptSections.join("\n\n"),
      images,
      schema: {
        type: "object",
        properties: {
          flow_slug: { type: ["string", "null"] },
          summary: { type: "string", description: "O que o cliente quer ou relatou, em uma frase clara." },
          replies: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                label: { type: "string", description: "Abordagem em 2-4 palavras (ex: 'Direta e rápida', 'Consultiva', 'Próximos passos')" },
                text: { type: "string", description: "Texto exato da mensagem para o WhatsApp." },
              },
              required: ["label", "text"],
            },
          },
          next_step: { type: "string", description: "Próximo passo recomendado no funil." },
          missing_info: { type: "array", items: { type: "string" }, description: "O que ainda falta perguntar ao cliente." },
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
  const row = {
    label: label || suggestion.summary.slice(0, 120),
    conversation_text: conversation || (suggestion.summary ? `[Print do WhatsApp] ${suggestion.summary}` : "[Print do WhatsApp]"),
    screenshot_paths: screenshotPaths,
    service_flow_id: chosen?.id ?? null,
    detected_flow_id: chosen ? null : (detected?.id ?? null),
    ai_output: suggestion,
  };

  const { data, error } = caseId
    ? await supabase.from("reply_cases").upsert({ id: caseId, ...row }).select("*").single()
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
