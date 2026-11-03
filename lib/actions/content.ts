"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getAiProvider, isAiConfigured } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import { type AgentSuggestion, getMarketingAgent, isMarketingAgentLive } from "@/lib/integrations/marketing-agent";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();
const link = z.object({ title: z.string().trim().max(200), url: z.url("Link inválido.").max(2000) });
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Cor inválida.");

// ---------------------------------------------------------------------------
// Pilares de conteúdo
// ---------------------------------------------------------------------------

const pillarFields = z
  .object({
    name: z.string().trim().min(1, "Dê um nome ao pilar.").max(80),
    color: hexColor.nullable(),
    description: z.string().trim().max(500).nullable(),
    sort_order: z.number().int(),
  })
  .partial();

export type PillarInput = z.input<typeof pillarFields>;

export async function createPillar(input: PillarInput): Promise<ActionResult<Tables<"content_pillars">>> {
  await getCurrentUser();
  const parsed = pillarFields.required({ name: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_pillars").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar o pilar.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updatePillar(pillarId: string, patch: PillarInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = pillarFields.safeParse(patch);
  if (!id.safeParse(pillarId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("content_pillars").update(parsed.data).eq("id", pillarId);
  if (error) return fail("Não foi possível salvar o pilar.");
  revalidatePath("/", "layout");
  return ok();
}

// Pilar não tem lixeira: as ideias dele ficam "sem pilar".
export async function deletePillar(pillarId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(pillarId).success) return fail("Pilar inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("content_pillars").delete().eq("id", pillarId);
  if (error) return fail("Não foi possível excluir o pilar.");
  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Ideias de conteúdo
// ---------------------------------------------------------------------------

const ideaFields = z
  .object({
    title: z.string().trim().min(1, "Escreva a ideia.").max(300),
    format: z.enum(["reel", "carousel", "post", "story"]).nullable(),
    pillar_id: id.nullable(),
    status: z.enum(["idea", "developing", "approved", "discarded"]),
    notes: z.string().max(20_000).nullable(),
    references: z.array(link).max(50),
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    folder_id: id.nullable(),
    marketing_agent_ref: z.string().max(200).nullable(),
  })
  .partial();

export type ContentIdeaInput = z.input<typeof ideaFields>;

export async function createContentIdea(input: ContentIdeaInput): Promise<ActionResult<Tables<"content_ideas">>> {
  await getCurrentUser();
  const parsed = ideaFields.required({ title: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("content_ideas").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar a ideia.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updateContentIdea(ideaId: string, patch: ContentIdeaInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = ideaFields.safeParse(patch);
  if (!id.safeParse(ideaId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const data = { ...parsed.data };
  if (data.tags) data.tags = [...new Set(data.tags.map((t) => t.toLowerCase()))];

  const supabase = await createClient();
  const { error } = await supabase.from("content_ideas").update(data).eq("id", ideaId);
  if (error) return fail("Não foi possível salvar a ideia.");
  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Publicações (calendário editorial)
// ---------------------------------------------------------------------------

const publicationFields = z
  .object({
    content_idea_id: id.nullable(),
    channel: z.enum(["instagram", "google_business"]),
    scheduled_for: z.iso.datetime({ offset: true }).nullable(),
    caption: z.string().max(5000).nullable(),
    status: z.enum(["idea", "script", "production", "scheduled", "published"]),
    published_url: z.url("Link inválido.").max(2000).nullable(),
    notes: z.string().max(20_000).nullable(),
  })
  .partial();

export type PublicationInput = z.input<typeof publicationFields>;

export async function createPublication(input: PublicationInput): Promise<ActionResult<Tables<"publications">>> {
  await getCurrentUser();
  const parsed = publicationFields.required({ channel: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const { data, error } = await supabase.from("publications").insert(parsed.data).select("*").single();
  if (error) return fail("Não foi possível criar a publicação.");
  revalidatePath("/", "layout");
  return ok(data);
}

export async function updatePublication(publicationId: string, patch: PublicationInput): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = publicationFields.safeParse(patch);
  if (!id.safeParse(publicationId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("publications").update(parsed.data).eq("id", publicationId);
  if (error) return fail("Não foi possível salvar a publicação.");
  revalidatePath("/", "layout");
  return ok();
}

// Lixeira para ideias de conteúdo e publicações.
export async function trashContent(kind: "content_ideas" | "publications", itemId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(itemId).success || !["content_ideas", "publications"].includes(kind)) return fail("Item inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from(kind).update({ deleted_at: new Date().toISOString() }).eq("id", itemId);
  if (error) return fail("Não foi possível excluir.");
  revalidatePath("/", "layout");
  return ok();
}

// ---------------------------------------------------------------------------
// Agente de Marketing & Sugestões de Conteúdo (Metodologia Ootto Content Skills)
// ---------------------------------------------------------------------------

export type ContentHypeFocus = "todos" | "reels" | "carrosseis" | "calor_cuiaba" | "venda_notebooks";

export type AgentSuggestionView = AgentSuggestion & {
  test: boolean;
  onScreenText?: string;
  emotionalAngle?: string;
  viralPotential?: string;
  trendReason?: string;
};

const FALLBACK_OOTTO_IDEAS: Record<ContentHypeFocus, AgentSuggestionView[]> = {
  todos: [
    {
      ref: "ootto-hype-1",
      title: "O calor de Cuiabá está fritando a placa do seu notebook em silêncio",
      format: "reel",
      pillar: "Manutenção",
      onScreenText: "SEU PC VAI QUEIMAR?",
      emotionalAngle: "Alerta & Urgência",
      viralPotential: "Alto Engajamento",
      trendReason: "Temperaturas acima de 40°C em Cuiabá aceleram o ressecamento da pasta térmica e thermal throttling.",
      notes: [
        "🎯 Ângulo: Alerta de dano invisível por conta do clima quente de Cuiabá.",
        "🔥 Por que está em alta: Alta procura por conserto de aparelhos travando e desligando sozinhos no calor.",
        "🗣️ Gancho Falado (0-3s): 'Se você mora em Cuiabá e usa notebook todo dia, preste muita atenção nisso aqui.'",
        "📺 Texto na Tela (0-3s): 'SEU PC VAI QUEIMAR?'",
        "📋 Estrutura & Retenção:\n1. (0-3s) Gancho com notebook aberto e pasta térmica petrificada.\n2. (3-12s) Explica por que o cooler não dá conta quando a poeira acumula no clima seco.\n3. (12-25s) Mostra a limpeza química e troca por pasta de alta condutividade térmica.\n4. (25-35s) Gráfico de temperatura caindo de 92°C para 65°C.",
        "👉 CTA: 'Não espere queimar: mande uma foto da sua máquina no direct ou WhatsApp da Trust Care para agendar uma preventiva.'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-hype-2",
      title: "Não compre um notebook novo antes de ver este teste de upgrade",
      format: "carousel",
      pillar: "Upgrades",
      onScreenText: "NÃO COMPRE NOVO AINDA!",
      emotionalAngle: "Alívio Financeiro",
      viralPotential: "Alta Taxa de Salvos",
      trendReason: "Preços abusivos de notebooks básicos novos nas lojas versus custo-benefício real de upgrade.",
      notes: [
        "🎯 Ângulo: Custo-benefício e alívio financeiro (economizar R$ 3.000 a R$ 4.000).",
        "🔥 Por que está em alta: Muita gente com notebook de 2018 a 2022 achando que precisa jogar fora.",
        "🗣️ Gancho Falado (0-3s): 'Você não precisa gastar 4 mil reais em um notebook novo para ter velocidade.'",
        "📺 Texto na Tela (0-3s): 'NÃO COMPRE NOVO AINDA!'",
        "📋 Estrutura & Retenção (Carrossel):\n- Slide 1: 'Gastar R$ 4.000 em notebook novo ou R$ 450 em upgrade?'\n- Slide 2: O segredo: o gargalo é o HD mecânico e memória em canal simples.\n- Slide 3: Comparativo de inicialização: 1m45s vs 11s com SSD NVMe.\n- Slide 4: Checklist: quando o seu aparelho ainda vale muito a pena.\n- Slide 5: Depoimentos e garantia Trust Care.",
        "👉 CTA: 'Mande o modelo exato do seu notebook no nosso WhatsApp para avaliarmos na hora.'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-hype-3",
      title: "O cliente achava que o notebook tinha queimado, mas era só isso aqui",
      format: "reel",
      pillar: "Laboratório",
      onScreenText: "IA JOGAR FORA!",
      emotionalAngle: "Curiosidade & Prova Social",
      viralPotential: "Alto Alcance (Reel de Bancada)",
      trendReason: "Conteúdo de bastidores de bancada tem retenção altíssima e combate o medo de golpe de assistência.",
      notes: [
        "🎯 Ângulo: Honestidade e transparência técnica de bancada.",
        "🔥 Por que está em alta: Formato de 'diagnóstico real de bancada' é o que mais viraliza no Instagram de tecnologia.",
        "🗣️ Gancho Falado (0-3s): 'Esse cliente chegou aqui desesperado dizendo que a placa-mãe dele tinha queimado...'",
        "📺 Texto na Tela (0-3s): 'IA JOGAR FORA!'",
        "📋 Estrutura & Retenção:\n1. (0-3s) Câmera em macro no microscópio ou bancada mostrando a máquina apagada.\n2. (3-15s) Mostra a linha de diagnóstico com multímetro (era apenas um capacitor em curto na entrada).\n3. (15-28s) Substituição do componente e o momento que a tela dá vídeo.\n4. (28-35s) Economia de 80% em relação a uma placa nova.",
        "👉 CTA: 'Diagnóstico justo e transparente. Traga sua máquina na Trust Care!'",
      ].join("\n\n"),
      test: false,
    },
  ],
  reels: [
    {
      ref: "ootto-reels-1",
      title: "3 erros que estão destruindo a bateria e o processador do seu notebook",
      format: "reel",
      pillar: "Dicas",
      onScreenText: "PARE DE FAZER ISSO!",
      emotionalAngle: "Medo de Perder a Máquina",
      viralPotential: "Viral (Compartilhamentos)",
      trendReason: "Erros comuns de uso como colocar no colo/cama e usar carregador paralelo de má qualidade.",
      notes: [
        "🎯 Ângulo: 'Pare de cometer esse erro' (formato com retenção comprovada).",
        "🔥 Por que está em alta: 8 a cada 10 pessoas usam notebook na cama ou sofá bloqueando saídas de ar.",
        "🗣️ Gancho Falado (0-3s): 'Se você faz o número 2, seu notebook pode parar de ligar a qualquer momento.'",
        "📺 Texto na Tela (0-3s): 'PARE DE FAZER ISSO!'",
        "📋 Estrutura & Retenção:\n- Erro 1: Usar em cima de coberta e almofadas (asfixia térmica).\n- Erro 2: Usar fonte universal pirata que não regula amperagem.\n- Erro 3: Fechar a tampa puxando por um canto só (quebra de dobradiça/carcaça).",
        "👉 CTA: 'Qual desses você faz? Compartilhe com quem vive usando notebook na cama!'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-reels-2",
      title: "Como saber se o seu SSD está prestes a morrer e levar todos os seus arquivos",
      format: "reel",
      pillar: "Prevenção",
      onScreenText: "SEUS ARQUIVOS VÃO SUMIR?",
      emotionalAngle: "Proteção de Dados & Urgência",
      viralPotential: "Alta Taxa de Salvos",
      trendReason: "Usuários não sabem que SSD morre subitamente sem fazer barulho, diferente do HD antigo.",
      notes: [
        "🎯 Ângulo: Prevenção de perda de arquivos e fotos de família.",
        "🔥 Por que está em alta: Desconhecimento geral sobre a vida útil de memórias flash e falta de backup.",
        "🗣️ Gancho Falado (0-3s): 'Diferente do HD que faz tec-tec, o SSD morre de repente sem avisar.'",
        "📺 Texto na Tela (0-3s): 'SEUS ARQUIVOS VÃO SUMIR?'",
        "📋 Estrutura & Retenção:\n1. Explica o sintoma da tela azul com erro de boot.\n2. Mostra como ver a saúde percentual no CrystalDiskInfo.\n3. Alerta para a regra do backup e substituição preventiva.",
        "👉 CTA: 'Salve este vídeo para checar a saúde do seu SSD hoje à noite.'",
      ].join("\n\n"),
      test: false,
    },
  ],
  carrosseis: [
    {
      ref: "ootto-carrossel-1",
      title: "Guia definitivo: Vale a pena fazer upgrade no seu notebook em 2026?",
      format: "carousel",
      pillar: "Upgrades",
      onScreenText: "UPGRADE OU PC NOVO?",
      emotionalAngle: "Decisão Racional & Economia",
      viralPotential: "Extrema Taxa de Salvos",
      trendReason: "Dúvida número 1 de quem tem um computador lento e não quer tomar prejuízo comprando outro.",
      notes: [
        "🎯 Ângulo: Matriz de decisão prática para o cliente.",
        "🔥 Por que está em alta: Guia prático que a pessoa salva para consultar antes de gastar dinheiro.",
        "🗣️ Gancho Falado: 'O passo a passo para saber se o seu notebook merece upgrade ou se já deu o tempo dele.'",
        "📺 Texto na Tela: 'UPGRADE OU PC NOVO?'",
        "📋 Estrutura & Retenção:\n- Slide 1: Capa com comparativo visual de notebook 2020 vs novo.\n- Slide 2: Quando VALE a pena (processador Core i3/i5/i7 a partir da 6ª geração, carcaça boa).\n- Slide 3: Quando NÃO vale a pena (processador soldado Celeron/Atom muito antigo).\n- Slide 4: O combo perfeito Trust Care: SSD NVMe + 16GB RAM + Limpeza térmica profunda.\n- Slide 5: Garantia e atendimento em Cuiabá.",
        "👉 CTA: 'Comente o processador do seu notebook que dizemos se vale a pena!'",
      ].join("\n\n"),
      test: false,
    },
  ],
  calor_cuiaba: [
    {
      ref: "ootto-cuiaba-1",
      title: "Por que computadores estragam 3x mais rápido em Cuiabá do que no Sul do Brasil?",
      format: "reel",
      pillar: "Manutenção",
      onScreenText: "O CALOR DE CUIABÁ",
      emotionalAngle: "Identificação Regional & Alerta",
      viralPotential: "Viral Regional Cuiabá",
      trendReason: "Conexão cultural forte com o calor e a poeira de Cuiabá gerando identificação imediata.",
      notes: [
        "🎯 Ângulo: Hiperlocal Cuiabá + choque térmico nos equipamentos.",
        "🔥 Por que está em alta: Identificação instantânea do público mato-grossense com o calor de 42°C.",
        "🗣️ Gancho Falado (0-3s): 'Tem um motivo pelo qual os computadores aqui em Cuiabá queimam muito mais rápido.'",
        "📺 Texto na Tela (0-3s): 'O CALOR DE CUIABÁ'",
        "📋 Estrutura & Retenção:\n1. Mostra o termômetro de Cuiabá e a bancada da Trust Care.\n2. Abre o dissipador e mostra a pasta ressecada como giz.\n3. Explica o estresse térmico na solda BGA dos chips.\n4. A solução: manutenção semestral com composto de alta durabilidade.",
        "👉 CTA: 'Seu notebook esquenta na perna? Mande um direct para agendar a limpeza.'",
      ].join("\n\n"),
      test: false,
    },
  ],
  venda_notebooks: [
    {
      ref: "ootto-vendas-1",
      title: "Notebook de vitrine por metade do preço de um novo: Como funciona?",
      format: "reel",
      pillar: "Vendas",
      onScreenText: "METADE DO PREÇO!",
      emotionalAngle: "Custo-Benefício & Garantia",
      viralPotential: "Geração Direta de Leads",
      trendReason: "Busca constante por notebooks corporativos seminovos (Dell Latitude, ThinkPad) que duram 10x mais que modelos de entrada.",
      notes: [
        "🎯 Ângulo: Quebra de preconceito com seminovos corporativos com nota e garantia.",
        "🔥 Por que está em alta: Notebook novo de loja a R$ 2.500 vem com carcaça frágil e Celeron, enquanto seminovo corporativo tem chassi de magnésio e Core i5/i7.",
        "🗣️ Gancho Falado (0-3s): 'Por que comprar um notebook descartável se você pode ter uma máquina de alta durabilidade?'",
        "📺 Texto na Tela (0-3s): 'METADE DO PREÇO!'",
        "📋 Estrutura & Retenção:\n1. Comparativo de robustez física.\n2. Mostra o processo de revisão e bateria testada da Trust Care.\n3. Mostra a garantia e pronta entrega em Cuiabá.",
        "👉 CTA: 'Chame no WhatsApp para ver os modelos disponíveis a pronta entrega esta semana.'",
      ].join("\n\n"),
      test: false,
    },
  ],
};

export async function getAgentSuggestions(params?: {
  focus?: ContentHypeFocus;
}): Promise<ActionResult<AgentSuggestionView[]>> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: pillars } = await supabase.from("content_pillars").select("name").order("sort_order");
  const focus = params?.focus ?? "todos";

  if (!isAiConfigured()) {
    const list = FALLBACK_OOTTO_IDEAS[focus] ?? FALLBACK_OOTTO_IDEAS.todos;
    return ok(list);
  }

  try {
    const ai = getAiProvider();
    const pillarList = (pillars ?? []).map((p) => p.name).join(", ");
    
    const focusPrompts: Record<ContentHypeFocus, string> = {
      todos: "Tendências no hype de informática, manutenção preventiva de computadores, upgrades de SSD/RAM e notebooks seminovos.",
      reels: "REELS de bancada de alta retenção (vídeo curto com ganchos visuais em 3s, defeito curioso, antes/depois, satisfatório).",
      carrosseis: "CARROSSÉIS educativos e comparativos técnicos diretos (ex: SSD vs HD, Quando vale a pena upgrade vs comprar notebook novo).",
      calor_cuiaba: "Problemas causados pelo calor extremo de Cuiabá (40°C+) e poeira: superaquecimento, travamentos, pasta térmica ressecada e prevenção.",
      venda_notebooks: "Revenda de notebooks seminovos revisados com garantia e procedência na Trust Care versus comprar notebooks novos básicos caros.",
    };

    const prompt = `Gere 5 ideias de conteúdo irresistíveis para o Instagram da Trust Care (assistência técnica e revenda de notebooks em Cuiabá-MT).

FOCO ATUAL: ${focusPrompts[focus]}
PILARES DISPONÍVEIS: ${pillarList || "Manutenção, Upgrades, Vendas, Dicas, Bastidores"}

Siga rigorosamente a metodologia Ootto Content Skills (trend-spotter, viral-hook-writer, reel-scripter):
1. TÍTULO / GANCHO (0-3s): Menos de 12 palavras, falado, quebra de padrão, chamativo, sem jargões enfadonhos.
2. TEXTO NA TELA: 3 a 5 palavras em caixa alta para a legenda visual inicial.
3. FORMATO: Escolha entre 'reel', 'carousel', 'story'.
4. EMOTIONAL ANGLE: O trabalho emocional (ex: Alívio de gasto, Medo de queimar, Curiosidade técnica, Prova de autoridade).
5. VIRAL POTENTIAL: Estimativa (ex: 'Viral', 'Alta Retenção', 'Conversão WhatsApp').
6. TREND REASON: O que torna este tema quente no momento.
7. HOOK SPOKEN: A frase falada exata dos primeiros 3 segundos.
8. STRUCTURE SUMMARY: Roteiro conciso de retenção (passo a passo das cenas ou slides).
9. CTA: Chamada direta para o WhatsApp ou Direct da Trust Care em Cuiabá.`;

    const schema = {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              format: { type: "string", enum: ["reel", "carousel", "story", "post"] },
              pillar: { type: "string" },
              onScreenText: { type: "string" },
              emotionalAngle: { type: "string" },
              viralPotential: { type: "string" },
              trendReason: { type: "string" },
              hookSpoken: { type: "string" },
              structureSummary: { type: "string" },
              cta: { type: "string" },
            },
            required: [
              "title",
              "format",
              "onScreenText",
              "emotionalAngle",
              "viralPotential",
              "trendReason",
              "hookSpoken",
              "structureSummary",
              "cta",
            ],
          },
        },
      },
      required: ["suggestions"],
    };

    const response = await ai.generateJson<{
      suggestions: Array<{
        title: string;
        format: "reel" | "carousel" | "story" | "post";
        pillar: string;
        onScreenText: string;
        emotionalAngle: string;
        viralPotential: string;
        trendReason: string;
        hookSpoken: string;
        structureSummary: string;
        cta: string;
      }>;
    }>({
      system:
        "Você é o Estrategista Chefe de Conteúdo Viral da Trust Care em Cuiabá-MT. Você domina as técnicas dos criadores que mais crescem organicamente no Instagram, usando a metodologia Ootto Content Skills.",
      prompt,
      schema,
    });

    const suggestions: AgentSuggestionView[] = (response.suggestions ?? []).map((s, idx) => ({
      ref: `ai-ootto-${Date.now()}-${idx}`,
      title: s.title,
      format: s.format,
      pillar: s.pillar,
      onScreenText: s.onScreenText,
      emotionalAngle: s.emotionalAngle,
      viralPotential: s.viralPotential,
      trendReason: s.trendReason,
      notes: [
        `🎯 Ângulo: ${s.emotionalAngle} (${s.viralPotential})`,
        `🔥 Por que está em alta: ${s.trendReason}`,
        `🗣️ Gancho Falado (0-3s): "${s.hookSpoken}"`,
        `📺 Texto na Tela (0-3s): "${s.onScreenText}"`,
        `📋 Estrutura & Retenção:\n${s.structureSummary}`,
        `👉 CTA: ${s.cta}`,
      ].join("\n\n"),
      test: false,
    }));

    if (suggestions.length === 0) {
      return ok(FALLBACK_OOTTO_IDEAS[focus] ?? FALLBACK_OOTTO_IDEAS.todos);
    }

    return ok(suggestions);
  } catch (err) {
    console.warn("getAgentSuggestions fallback acionado:", err);
    return ok(FALLBACK_OOTTO_IDEAS[focus] ?? FALLBACK_OOTTO_IDEAS.todos);
  }
}

export async function sendIdeaToAgent(ideaId: string): Promise<ActionResult<{ ref: string }>> {
  await getCurrentUser();
  if (!id.safeParse(ideaId).success) return fail("Ideia inválida.");

  const supabase = await createClient();
  const { data: idea } = await supabase
    .from("content_ideas")
    .select("id, title, format, notes, content_pillars(name)")
    .eq("id", ideaId)
    .single();
  if (!idea) return fail("Ideia não encontrada.");

  try {
    const { ref } = await getMarketingAgent().sendIdea({
      id: idea.id,
      title: idea.title,
      format: idea.format as AgentSuggestion["format"],
      pillar: idea.content_pillars?.name ?? null,
      notes: idea.notes,
    });
    await supabase.from("content_ideas").update({ marketing_agent_ref: ref }).eq("id", ideaId);
    revalidatePath("/", "layout");
    return ok({ ref });
  } catch (error) {
    console.error("sendIdeaToAgent", error);
    return fail("O Agente de Marketing não respondeu.");
  }
}
