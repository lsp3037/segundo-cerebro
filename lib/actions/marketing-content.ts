"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAiProvider } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import type { ScriptData } from "@/lib/data/marketing";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";
import type {
  CarouselScriptData,
  ReelScriptData,
  StorySequenceData,
} from "@/components/trustcare/marketing/meta";

const idSchema = z.uuid("ID inválido");

// ---------------------------------------------------------------------------
// Salvar Roteiro de Reel
// ---------------------------------------------------------------------------

const reelInputSchema = z.object({
  id: z.string().uuid().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  campaign_angle_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Dê um título ao Reel.").max(250),
  hook_3s: z.string().trim().min(1, "Preencha o gancho inicial."),
  retention_body: z.array(z.string().trim()).min(1, "Adicione ao menos 1 tópico de retenção."),
  cta: z.string().trim().min(1, "Preencha a chamada para ação (CTA)."),
  audio_suggestion: z.string().trim().default("Áudio instrumental em alta"),
  duration_seconds: z.number().int().min(5).max(180).default(45),
  status: z.enum(["idea", "developing", "approved", "discarded"]).default("developing"),
});

export type ReelInput = z.infer<typeof reelInputSchema>;

export async function saveReelScript(input: ReelInput): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = reelInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const scriptData: ReelScriptData = {
    type: "reel",
    hook_3s: parsed.data.hook_3s,
    retention_body: parsed.data.retention_body,
    cta: parsed.data.cta,
    audio_suggestion: parsed.data.audio_suggestion,
    duration_seconds: parsed.data.duration_seconds,
  };

  const supabase = await createClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("content_ideas")
      .update({
        title: parsed.data.title,
        campaign_angle_id: parsed.data.campaign_angle_id ?? null,
        script_data: scriptData as unknown as Json,
        format: "reel",
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);

    if (error) {
      console.error("Erro ao atualizar roteiro de Reel:", error);
      return fail("Não foi possível salvar o roteiro.");
    }
    revalidatePath("/", "layout");
    return ok({ id: parsed.data.id });
  }

  const { data, error } = await supabase
    .from("content_ideas")
    .insert({
      title: parsed.data.title,
      folder_id: parsed.data.folder_id ?? null,
      campaign_angle_id: parsed.data.campaign_angle_id ?? null,
      format: "reel",
      status: parsed.data.status,
      script_data: scriptData as unknown as Json,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar roteiro de Reel:", error);
    return fail("Não foi possível criar o roteiro.");
  }

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

// ---------------------------------------------------------------------------
// Salvar Sequência de Stories
// ---------------------------------------------------------------------------

const storyFrameSchema = z.object({
  number: z.number().int().min(1),
  goal: z.string().trim().min(1),
  text: z.string().trim().min(1),
  interactive_element: z.string().trim().default(""),
});

const storyInputSchema = z.object({
  id: z.string().uuid().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  campaign_angle_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Dê um título à sequência.").max(250),
  frames: z.array(storyFrameSchema).min(1, "Defina ao menos um quadro de story."),
  status: z.enum(["idea", "developing", "approved", "discarded"]).default("developing"),
});

export type StoryInput = z.infer<typeof storyInputSchema>;

export async function saveStorySequence(input: StoryInput): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = storyInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const scriptData: StorySequenceData = {
    type: "story",
    frames: parsed.data.frames,
  };

  const supabase = await createClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("content_ideas")
      .update({
        title: parsed.data.title,
        campaign_angle_id: parsed.data.campaign_angle_id ?? null,
        script_data: scriptData as unknown as Json,
        format: "story",
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);

    if (error) {
      console.error("Erro ao atualizar sequência de Stories:", error);
      return fail("Não foi possível salvar a sequência.");
    }
    revalidatePath("/", "layout");
    return ok({ id: parsed.data.id });
  }

  const { data, error } = await supabase
    .from("content_ideas")
    .insert({
      title: parsed.data.title,
      folder_id: parsed.data.folder_id ?? null,
      campaign_angle_id: parsed.data.campaign_angle_id ?? null,
      format: "story",
      status: parsed.data.status,
      script_data: scriptData as unknown as Json,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar sequência de Stories:", error);
    return fail("Não foi possível criar a sequência.");
  }

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

// ---------------------------------------------------------------------------
// Salvar Carrossel Slide a Slide
// ---------------------------------------------------------------------------

const carouselSlideSchema = z.object({
  index: z.number().int().min(1),
  role: z.enum(["capa", "conteudo", "cta"]),
  headline: z.string().trim().min(1, "Preencha a chamada do slide."),
  body: z.string().trim().optional(),
  visual_cue: z.string().trim().default(""),
});

const carouselInputSchema = z.object({
  id: z.string().uuid().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  campaign_angle_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Dê um título ao carrossel.").max(250),
  slides: z.array(carouselSlideSchema).min(2, "O carrossel precisa ter pelo menos 2 slides."),
  status: z.enum(["idea", "developing", "approved", "discarded"]).default("developing"),
});

export type CarouselInput = z.infer<typeof carouselInputSchema>;

export async function saveCarouselScript(input: CarouselInput): Promise<ActionResult<{ id: string }>> {
  await getCurrentUser();
  const parsed = carouselInputSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const scriptData: CarouselScriptData = {
    type: "carousel",
    slides: parsed.data.slides,
  };

  const supabase = await createClient();

  if (parsed.data.id) {
    const { error } = await supabase
      .from("content_ideas")
      .update({
        title: parsed.data.title,
        campaign_angle_id: parsed.data.campaign_angle_id ?? null,
        script_data: scriptData as unknown as Json,
        format: "carousel",
        status: parsed.data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id);

    if (error) {
      console.error("Erro ao atualizar carrossel:", error);
      return fail("Não foi possível salvar o carrossel.");
    }
    revalidatePath("/", "layout");
    return ok({ id: parsed.data.id });
  }

  const { data, error } = await supabase
    .from("content_ideas")
    .insert({
      title: parsed.data.title,
      folder_id: parsed.data.folder_id ?? null,
      campaign_angle_id: parsed.data.campaign_angle_id ?? null,
      format: "carousel",
      status: parsed.data.status,
      script_data: scriptData as unknown as Json,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Erro ao criar carrossel:", error);
    return fail("Não foi possível criar o carrossel.");
  }

  revalidatePath("/", "layout");
  return ok({ id: data.id });
}

// ---------------------------------------------------------------------------
// Salvar Roteiro Genérico (Reel, Story ou Carrossel)
// ---------------------------------------------------------------------------

export async function saveScriptData(
  contentIdeaId: string,
  scriptData: ScriptData,
  angleId?: string | null
): Promise<ActionResult> {
  await getCurrentUser();
  if (!idSchema.safeParse(contentIdeaId).success) return fail("ID de ideia de conteúdo inválido.");

  const supabase = await createClient();

  const updatePayload: Database["public"]["Tables"]["content_ideas"]["Update"] = {
    script_data: scriptData as unknown as Json,
    updated_at: new Date().toISOString(),
  };

  if ("type" in scriptData && typeof scriptData.type === "string") {
    updatePayload.format = scriptData.type;
  }

  if (angleId !== undefined) {
    if (angleId && !idSchema.safeParse(angleId).success) {
      return fail("ID de ângulo de campanha inválido.");
    }
    updatePayload.campaign_angle_id = angleId;
  }

  const { error } = await supabase
    .from("content_ideas")
    .update(updatePayload)
    .eq("id", contentIdeaId);

  if (error) {
    console.error("Erro ao salvar roteiro de marketing:", error);
    return fail("Não foi possível salvar o roteiro.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Exclusão de Roteiro
// ---------------------------------------------------------------------------

export async function deleteContentScript(scriptId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!idSchema.safeParse(scriptId).success) return fail("ID de roteiro inválido.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("content_ideas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", scriptId);

  if (error) {
    console.error("Erro ao excluir roteiro:", error);
    return fail("Não foi possível excluir o roteiro.");
  }

  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Geração com IA para Roteiros (Específicos e Unificado)
// ---------------------------------------------------------------------------

export async function generateReelWithAi(topic: string): Promise<ActionResult<Omit<ReelScriptData, "type"> & { title: string }>> {
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
    const prompt = `Você é o estrategista de conteúdo em vídeo da Trust Care (assistência especializada em notebooks e computadores de alta performance em Cuiabá).
Tema do Reel solicitado: "${topic}".

Estruture um roteiro magnético de Reel com 30 a 60 segundos:
1. Gancho nos primeiros 3 segundos (frase de impacto visual/auditivo para parar o feed).
2. Desenvolvimento/Retenção: de 3 a 5 passos práticos ou demonstrações visuais no laboratório da Trust Care.
3. CTA: chamada clara para enviar direct ou chamar no WhatsApp.
4. Sugestão de estilo de áudio dinâmico.`;

    const result = await ai.generateJson<{
      title: string;
      hook_3s: string;
      retention_body: string[];
      cta: string;
      audio_suggestion: string;
      duration_seconds: number;
    }>({
      system: "Você é um roteirista de vídeos curtos do Instagram focado no mercado local de Cuiabá. Seja direto, visual e prático.",
      prompt,
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          hook_3s: { type: "string" },
          retention_body: { type: "array", items: { type: "string" } },
          cta: { type: "string" },
          audio_suggestion: { type: "string" },
          duration_seconds: { type: "number" },
        },
        required: ["title", "hook_3s", "retention_body", "cta", "audio_suggestion", "duration_seconds"],
      },
    });

    return ok(result);
  } catch (err) {
    console.error("Fallback IA Reel:", err);
    return ok({
      title: `Por que seu notebook esquenta tanto? (${topic.slice(0, 30)})`,
      hook_3s: "Se o seu notebook parece uma turbina de avião, você corre o risco de perder a placa-mãe!",
      retention_body: [
        "Mostre o cooler entupido com poeira acumulada",
        "Mostre a pasta térmica original que ressecou como pedra",
        "Apresente a limpeza química completa e a troca por pasta de prata",
        "Teste a temperatura caindo de 92°C para 45°C em tempo real",
      ],
      cta: "Seu notebook está esquentando? Comente 'REVISÃO' que te mando os valores pelo direct.",
      audio_suggestion: "Áudio instrumental enérgico com batida marcada",
      duration_seconds: 40,
    });
  }
}

export async function generateStorySequenceWithAi(topic: string): Promise<ActionResult<{ title: string; frames: StorySequenceData["frames"] }>> {
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
    const prompt = `Crie uma sequência diária de 4 Stories com alta interação para a Trust Care em Cuiabá.
Tema: "${topic}".
Estrutura clássica de conversão:
Quadro 1: Contexto/Curiosidade + Enquete
Quadro 2: Bastidores / O problema real encontrado na bancada
Quadro 3: A Solução técnica impecável aplicada
Quadro 4: Oferta / Chamada de ação com caixinha ou link do WhatsApp.`;

    const result = await ai.generateJson<{
      title: string;
      frames: Array<{ number: number; goal: string; text: string; interactive_element: string }>;
    }>({
      system: "Você é especialista em engajamento e vendas através dos Stories do Instagram para negócios locais de assistência técnica.",
      prompt,
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          frames: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "number" },
                goal: { type: "string" },
                text: { type: "string" },
                interactive_element: { type: "string" },
              },
              required: ["number", "goal", "text", "interactive_element"],
            },
          },
        },
        required: ["title", "frames"],
      },
    });

    return ok(result);
  } catch (err) {
    console.error("Fallback IA Stories:", err);
    return ok({
      title: `Sequência de Bancada: ${topic.slice(0, 30)}`,
      frames: [
        {
          number: 1,
          goal: "Contexto & Curiosidade",
          text: "Olha o que acabou de entrar aqui na bancada da Trust Care hoje...",
          interactive_element: "Enquete: 'Você já abriu seu computador alguma vez?'",
        },
        {
          number: 2,
          goal: "Diagnóstico / Problema",
          text: "O cliente achava que o PC tinha queimado, mas olha a oxidação nessa linha de 19V.",
          interactive_element: "Foto com zoom e seta vermelha",
        },
        {
          number: 3,
          goal: "Solução Técnica",
          text: "Reparo de micro-solda feito com microscópio, sem precisar condenar a placa toda!",
          interactive_element: "Vídeo curto da luz da placa ligando",
        },
        {
          number: 4,
          goal: "CTA / Conversão",
          text: "Seu equipamento parou do nada? Não compre outro antes de uma avaliação honesta.",
          interactive_element: "Botão com link direto para o WhatsApp",
        },
      ],
    });
  }
}

export async function generateCarouselWithAi(topic: string): Promise<ActionResult<{ title: string; slides: CarouselScriptData["slides"] }>> {
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
    const prompt = `Crie um carrossel educativo e de vendas com 4 a 6 slides para o Instagram da Trust Care em Cuiabá.
Tema: "${topic}".
- Slide 1: Capa ultra atraente com headline magnética e indicação visual.
- Slides do meio: Conteúdo de alto valor, dicas que resolvem a dúvida do cliente de modo simples.
- Último slide: CTA para salvar o post, compartilhar e chamar a Trust Care no WhatsApp.`;

    const result = await ai.generateJson<{
      title: string;
      slides: Array<{
        index: number;
        role: "capa" | "conteudo" | "cta";
        headline: string;
        body?: string;
        visual_cue: string;
      }>;
    }>({
      system: "Você é um copywriter de carrosséis virais do Instagram para empresas de tecnologia e computação.",
      prompt,
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          slides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "number" },
                role: { type: "string", enum: ["capa", "conteudo", "cta"] },
                headline: { type: "string" },
                body: { type: "string" },
                visual_cue: { type: "string" },
              },
              required: ["index", "role", "headline", "visual_cue"],
            },
          },
        },
        required: ["title", "slides"],
      },
    });

    return ok(result);
  } catch (err) {
    console.error("Fallback IA Carrossel:", err);
    return ok({
      title: `Guia de Sobrevivência do seu PC: ${topic.slice(0, 25)}`,
      slides: [
        {
          index: 1,
          role: "capa",
          headline: "4 Erros comuns que estão destruindo o seu notebook aos poucos",
          body: "O número 3 quase todo mundo faz sem perceber.",
          visual_cue: "Foto dramática de um notebook na cama sobre cobertor",
        },
        {
          index: 2,
          role: "conteudo",
          headline: "1. Usar o aparelho em cima da cama ou almofada",
          body: "Bloqueia as saídas de ar inferiores, fazendo o chip de vídeo trabalhar a mais de 90°C.",
          visual_cue: "Ilustração do fluxo de ar bloqueado pelas fibras do tecido",
        },
        {
          index: 3,
          role: "conteudo",
          headline: "2. Puxar o carregador pelo cabo e não pelo plugue",
          body: "Causa curto no jack interno e pode romper as trilhas da placa-mãe.",
          visual_cue: "Close no plugue danificado e faísca interna",
        },
        {
          index: 4,
          role: "cta",
          headline: "Quer seu computador rodando rápido e frio como novo?",
          body: "Traga na Trust Care para uma revisão preventiva completa. Salve esse post!",
          visual_cue: "Foto do laboratório limpo e logo da Trust Care com WhatsApp",
        },
      ],
    });
  }
}

export interface GenerateScriptWithAiInput {
  format: "reel" | "story" | "carousel";
  topic: string;
  targetAudience?: string;
  angleId?: string;
}

/**
 * Ação unificada para gerar roteiro com IA em qualquer um dos 3 formatos.
 */
export async function generateScriptWithAi(input: GenerateScriptWithAiInput): Promise<ActionResult<ScriptData>> {
  if (input.format === "reel") {
    const res = await generateReelWithAi(input.topic);
    if (!res.ok) return fail(res.error);
    return ok({
      type: "reel",
      hook_3s: res.data.hook_3s,
      retention_body: res.data.retention_body,
      cta: res.data.cta,
      audio_suggestion: res.data.audio_suggestion,
      duration_seconds: res.data.duration_seconds,
    });
  }

  if (input.format === "story") {
    const res = await generateStorySequenceWithAi(input.topic);
    if (!res.ok) return fail(res.error);
    return ok({
      type: "story",
      frames: res.data.frames,
    });
  }

  const res = await generateCarouselWithAi(input.topic);
  if (!res.ok) return fail(res.error);
  return ok({
    type: "carousel",
    slides: res.data.slides.map((s) => ({
      index: s.index,
      role: s.role,
      headline: s.headline,
      visual_cue: s.visual_cue,
      body_text: s.body,
    })),
  });
}
