"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAiProvider } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const idSchema = z.uuid("ID inválido");
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD).");

// ---------------------------------------------------------------------------
// Campanhas de Marketing
// ---------------------------------------------------------------------------

const campaignFields = z.object({
  name: z.string().trim().min(1, "Dê um nome à campanha.").max(200),
  objective: z.string().trim().min(1, "Selecione o objetivo."),
  status: z.string().trim().default("draft"),
  budget_daily_cents: z.number().int().min(0, "Orçamento diário não pode ser negativo.").default(0),
  budget_total_cents: z.number().int().min(0, "Orçamento total não pode ser negativo.").default(0),
  start_date: isoDateSchema,
  end_date: isoDateSchema.nullable().optional(),
  target_audience: z.string().trim().max(1000).nullable().optional(),
  meta_campaign_id: z.string().trim().max(100).nullable().optional(),
  notes: z.string().trim().max(5000).nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
});

export type CampaignInput = z.infer<typeof campaignFields>;

export async function createCampaign(input: CampaignInput): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = campaignFields.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar campanha:", error);
    return fail("Não foi possível criar a campanha.");
  }

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<CampaignInput>,
): Promise<ActionResult> {
  await getCurrentUser();
  if (!idSchema.safeParse(campaignId).success) return fail("ID de campanha inválido.");

  const parsed = campaignFields.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  if (error) {
    console.error("Erro ao atualizar campanha:", error);
    return fail("Não foi possível atualizar a campanha.");
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function trashCampaign(campaignId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!idSchema.safeParse(campaignId).success) return fail("ID de campanha inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_campaigns")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", campaignId);

  if (error) {
    console.error("Erro ao excluir campanha:", error);
    return fail("Não foi possível excluir a campanha.");
  }

  revalidatePath("/", "layout");
  return ok();
}

export const deleteCampaign = trashCampaign;

// ---------------------------------------------------------------------------
// Ângulos de Anúncios (Matriz de Ângulos)
// ---------------------------------------------------------------------------

const angleFields = z.object({
  campaign_id: z.string().uuid("Selecione uma campanha válida."),
  title: z.string().trim().min(1, "Dê um título ao ângulo.").max(200),
  target_avatar: z.string().trim().max(300).nullable().optional(),
  hook_angle: z.string().trim().min(1, "Selecione o gancho/ângulo."),
  headline: z.string().trim().max(300).nullable().optional(),
  body_copy: z.string().trim().max(10000).nullable().optional(),
  call_to_action: z.string().trim().max(300).nullable().optional(),
  creative_format: z.string().trim().default("video_reel"),
  asset_url: z.string().trim().max(2000).nullable().optional(),
  meta_ad_id: z.string().trim().max(100).nullable().optional(),
  status: z.string().trim().default("draft"),
  metrics_cached: z.record(z.string(), z.unknown()).optional(),
});

export type AngleInput = z.infer<typeof angleFields>;

export async function createAngle(input: AngleInput): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = angleFields.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_angles")
    .insert({
      campaign_id: parsed.data.campaign_id,
      title: parsed.data.title,
      target_avatar: parsed.data.target_avatar ?? null,
      hook_angle: parsed.data.hook_angle,
      headline: parsed.data.headline ?? null,
      body_copy: parsed.data.body_copy ?? null,
      call_to_action: parsed.data.call_to_action ?? null,
      creative_format: parsed.data.creative_format,
      asset_url: parsed.data.asset_url ?? null,
      meta_ad_id: parsed.data.meta_ad_id ?? null,
      status: parsed.data.status,
      metrics_cached: (parsed.data.metrics_cached ?? {}) as Json,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar ângulo:", error);
    return fail("Não foi possível criar o ângulo de anúncio.");
  }

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

export async function updateAngle(
  angleId: string,
  patch: Partial<AngleInput>,
): Promise<ActionResult> {
  await getCurrentUser();
  if (!idSchema.safeParse(angleId).success) return fail("ID de ângulo inválido.");

  const parsed = angleFields.partial().safeParse(patch);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const updatePayload: Database["public"]["Tables"]["campaign_angles"]["Update"] = {
    ...parsed.data,
    metrics_cached: parsed.data.metrics_cached as Json | undefined,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("campaign_angles")
    .update(updatePayload)
    .eq("id", angleId);

  if (error) {
    console.error("Erro ao atualizar ângulo:", error);
    return fail("Não foi possível atualizar o ângulo.");
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function trashAngle(angleId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!idSchema.safeParse(angleId).success) return fail("ID de ângulo inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_angles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", angleId);

  if (error) {
    console.error("Erro ao excluir ângulo:", error);
    return fail("Não foi possível excluir o ângulo.");
  }

  revalidatePath("/", "layout");
  return ok();
}

export const deleteAngle = trashAngle;

// ---------------------------------------------------------------------------
// Geração com IA: Sugerir Ângulos de Anúncios para a Trust Care
// ---------------------------------------------------------------------------

export type SuggestedAngleItem = {
  title: string;
  hook_angle: "dor_urgencia" | "custo_beneficio" | "prova_social" | "autoridade_tecnica" | "oportunidade";
  target_avatar: string;
  headline: string;
  body_copy: string;
  call_to_action: string;
  creative_format: "video_reel" | "carousel" | "single_image" | "story";
};

export interface GenerateAngleSuggestionsInput {
  campaignObjective: string;
  campaignName?: string;
  targetAudience?: string;
  currentOffer?: string;
}

/**
 * Usa o Gemini para sugerir 3 ângulos distintos de criativos para a campanha da Trust Care.
 */
export async function generateAngleSuggestions(
  input: GenerateAngleSuggestionsInput
): Promise<ActionResult<SuggestedAngleItem[]>> {
  await getCurrentUser();

  const supabase = await createClient();
  const { data: area } = await supabase.from("areas").select("id").eq("slug", "trustcare").single();
  if (area) {
    try {
      await assertAreaAllowsAi(area.id);
    } catch (error) {
      return fail((error as Error).message);
    }
  }

  try {
    const ai = getAiProvider();
    const prompt = `Você é o Diretor de Criação e Estrategista de Tráfego Pago da Trust Care em Cuiabá e Várzea Grande (MT).
A Trust Care é referência em manutenção avançada de computadores, reparo em placa-mãe, upgrades de alta performance (SSD NVMe, memória) e revenda de notebooks seminovos revisados com garantia.

Gere exatamente 3 ângulos estratégicos de anúncios complementares para esta campanha:
- Objetivo da Campanha: ${input.campaignObjective}
- Nome da Campanha: ${input.campaignName || "Campanha Trust Care"}
- Público-Alvo: ${input.targetAudience || "Pessoas de Cuiabá/VG com notebook lento, travando ou precisando de manutenção"}
- Oferta/Contexto: ${input.currentOffer || "Diagnóstico sem compromisso + upgrade rápido ou manutenção preventiva"}

Cada um dos 3 ângulos deve explorar uma abordagem psicológica diferente:
1. Dor/Urgência (ex: PC travando no trabalho, superaquecimento no calor de Cuiabá, lentidão irritante)
2. Custo-Benefício / Economia Inteligente (ex: não gaste R$ 4.000 em notebook novo; faça um upgrade por uma fração do preço)
3. Autoridade Técnica / Prova Social (ex: laboratório especializado, técnicos de confiança, garantia e transparência)

Para cada ângulo, defina:
- title: Nome claro do ângulo (ex: "Ângulo 1: Travamento no Home Office")
- hook_angle: Um dos seguintes valores exatos: "dor_urgencia", "custo_beneficio", "prova_social", "autoridade_tecnica", "oportunidade"
- target_avatar: Descrição objetiva de quem é impactado (ex: "Advogados e contadores em Cuiabá")
- headline: Gancho magnético de até 150 caracteres para prender a atenção nos primeiros 3 segundos
- body_copy: Roteiro conciso de 2 a 4 frases persuadindo e mostrando a solução Trust Care
- call_to_action: CTA direto para WhatsApp (ex: "Clique no botão e mande uma mensagem no WhatsApp da Trust Care")
- creative_format: "video_reel", "carousel", "single_image" ou "story"`;

    const result = await ai.generateJson<{ angles: SuggestedAngleItem[] }>({
      system:
        "Você é um copywriter de elite e estrategista de tráfego pago local. Escreva em português do Brasil, natural, sem jargões desnecessários, com foco em conversão para WhatsApp em Cuiabá/VG.",
      prompt,
      schema: {
        type: "object",
        properties: {
          angles: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                hook_angle: {
                  type: "string",
                  enum: ["dor_urgencia", "custo_beneficio", "prova_social", "autoridade_tecnica", "oportunidade"],
                },
                target_avatar: { type: "string" },
                headline: { type: "string" },
                body_copy: { type: "string" },
                call_to_action: { type: "string" },
                creative_format: {
                  type: "string",
                  enum: ["video_reel", "carousel", "single_image", "story"],
                },
              },
              required: ["title", "hook_angle", "target_avatar", "headline", "body_copy", "call_to_action", "creative_format"],
            },
          },
        },
        required: ["angles"],
      },
    });

    return ok(result.angles ?? []);
  } catch (err) {
    console.warn("generateAngleSuggestions fallback acionado:", err);
    // Fallback resiliente com 3 ângulos testados da Trust Care em Cuiabá
    return ok([
      {
        title: "Ângulo Dor: O Notebook que Trava na Hora Crítica",
        hook_angle: "dor_urgencia",
        target_avatar: "Profissionais liberais e estudantes em Cuiabá que perdem tempo com PC lento",
        headline: "Seu notebook demora mais para ligar do que você para fazer um café?",
        body_copy:
          "Trabalhar com computador travando custa tempo e paciência. Na Trust Care, realizamos limpeza química e upgrade de SSD que deixam sua máquina até 10x mais rápida no mesmo dia.",
        call_to_action: "Envie uma mensagem no WhatsApp e solicite um orçamento rápido sem compromisso.",
        creative_format: "video_reel",
      },
      {
        title: "Ângulo Economia: Renove sem Gastar R$ 4.000",
        hook_angle: "custo_beneficio",
        target_avatar: "Donos de notebooks de 3 a 7 anos de uso pensando em trocar de aparelho",
        headline: "Não compre um notebook novo antes de ver este vídeo!",
        body_copy:
          "Você não precisa gastar milhares de reais em uma máquina nova. Com uma revisão completa e upgrade de componentes na Trust Care, seu notebook atual volta a voar com garantia.",
        call_to_action: "Mande o modelo do seu notebook no WhatsApp e descubra quanto você economiza.",
        creative_format: "carousel",
      },
      {
        title: "Ângulo Autoridade: Cuidado com o Calor de Cuiabá",
        hook_angle: "autoridade_tecnica",
        target_avatar: "Usuários de notebooks e PCs que usam a máquina o dia todo",
        headline: "O calor de Cuiabá pode estar destruindo a placa do seu computador silenciosamente.",
        body_copy:
          "Pasta térmica seca e poeira acumulada causam superaquecimento e queima de componentes vitais. No laboratório da Trust Care fazemos manutenção preventiva profunda para seu PC durar anos a mais.",
        call_to_action: "Agende sua revisão preventiva pelo WhatsApp da Trust Care.",
        creative_format: "video_reel",
      },
    ]);
  }
}

export type SuggestedAngleResult = {
  headline: string;
  body_copy: string;
  call_to_action: string;
  target_avatar: string;
};

export async function suggestHooksWithAi(params: {
  campaignName: string;
  targetAvatar?: string;
  hookAngle: string;
}): Promise<ActionResult<SuggestedAngleResult>> {
  const result = await generateAngleSuggestions({
    campaignName: params.campaignName,
    campaignObjective: "whatsapp_leads",
    targetAudience: params.targetAvatar,
  });

  if (!result.ok || result.data.length === 0) {
    return ok({
      headline: "Seu notebook trava na hora que você mais precisa?",
      body_copy:
        "Não gaste R$ 4.000 em um aparelho novo. Na Trust Care em Cuiabá, um upgrade com SSD NVMe e limpeza preventiva devolve a velocidade máxima do seu computador no mesmo dia.",
      call_to_action: "Clique no botão abaixo e fale direto com o especialista no WhatsApp.",
      target_avatar: "Profissionais em Cuiabá que dependem do computador para trabalhar",
    });
  }

  const first = result.data[0];
  return ok({
    headline: first.headline,
    body_copy: first.body_copy,
    call_to_action: first.call_to_action,
    target_avatar: first.target_avatar,
  });
}
