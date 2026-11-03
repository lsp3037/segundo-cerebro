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
  const user = await getCurrentUser();
  const parsed = ideaFields.required({ title: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const supabase = await createClient();
  const insertPayload = {
    ...parsed.data,
    user_id: user.id,
    status: parsed.data.status ?? "idea",
  };

  const { data, error } = await supabase.from("content_ideas").insert(insertPayload).select("*").single();
  if (error) {
    console.error("createContentIdea error details:", error);
    return fail(`Erro ao salvar no banco: ${error.message}`);
  }
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

export type ContentHypeFocus = "todos" | "reels" | "carrosseis" | "stories" | "calor_cuiaba" | "venda_notebooks";

export type AgentSuggestionView = AgentSuggestion & {
  test: boolean;
  onScreenText?: string;
  coverHeadline?: string;
  interactivePoll?: string;
  emotionalAngle?: string;
  viralPotential?: string;
  trendReason?: string;
};

async function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timeout ao consultar IA")), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

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
      title: "Notebook velho tem salvação? A conta dos 30% para não gastar R$ 3.800",
      format: "carousel",
      pillar: "Upgrades",
      coverHeadline: "NOTEBOOK LENTO: A CONTA DOS 30%",
      emotionalAngle: "Decisão Racional & Economia",
      viralPotential: "Extrema Taxa de Salvos",
      trendReason: "Preços abusivos de notebooks básicos novos (R$ 3.500+) versus custo-benefício comprovado de upgrade.",
      notes: [
        "🎯 Ângulo: Matriz de decisão financeira objetiva (Skill carousel-builder).",
        "🔥 Por que está em alta: Em 2026, com notebooks novos caros e frágeis, o consumidor inteligente opta por upgrade.",
        "🖼️ Capa (Slide 1): 'NOTEBOOK LENTO: A CONTA DOS 30%'",
        "📊 Estrutura Slide a Slide (Skill carousel-builder):\nSlide 1 [CAPA]: Notebook velho tem salvação? A regra matemática dos 30% que as lojas escondem.\n   🎨 Visual: Foto de notebook antigo robusto ao lado de um novo com etiqueta de R$ 3.800.\n\nSlide 2 [CONTEUDO]: A Regra dos 30%\n   Se o upgrade completo (SSD NVMe + RAM + Pasta Térmica) custar até 30% de um novo equivalente, é irracional comprar outro.\n   Investimento Trust Care: ~R$ 480 vs R$ 3.500 na loja. Economia real: mais de R$ 3.000 no bolso.\n   🎨 Visual: Gráfico de barras simples comparando R$ 480 vs R$ 3.500.\n\nSlide 3 [CONTEUDO]: Onde o seu notebook está estrangulado\n   O processador (Core i5 ou Ryzen) ainda tem sobra de força. O que trava tudo é o HD mecânico a 100% no Windows e memória de canal simples.\n   🎨 Visual: Print do Gerenciador de Tarefas com disco a 100% em vermelho.\n\nSlide 4 [CONTEUDO]: A transformação no cronômetro\n   Com HD antigo: 1m50s para ligar e 40s para abrir o Word.\n   Com SSD NVMe Gen3/Gen4 na bancada da Trust Care: 8 segundos para ligar e clique instantâneo.\n   🎨 Visual: Cronômetros comparativos lado a lado.\n\nSlide 5 [CHECKLIST]: Quando NÃO vale a pena\n   Processador soldado Celeron/Atom muito antigo ou carcaça/tela totalmente destruídas. Seja honesto com seu bolso.\n   🎨 Visual: Tabela de decisão rápida para print.\n\nSlide 6 [CTA]: Descubra se o seu vale a pena\n   Envie uma foto ou o modelo exato do seu notebook no WhatsApp da Trust Care para avaliação sem compromisso.",
        "👉 CTA Final: 'Mande o modelo do seu notebook no WhatsApp da Trust Care para avaliarmos.'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-carrossel-2",
      title: "SSD SATA vs SSD NVMe Gen4: O que você precisa saber antes de comprar",
      format: "carousel",
      pillar: "Dicas",
      coverHeadline: "SATA VS NVME: NÃO ERRE A PEÇA",
      emotionalAngle: "Educação Técnica & Evitar Prejuízo",
      viralPotential: "Altíssimo Salvamento",
      trendReason: "Erros comuns de clientes comprando SSDs incompatíveis em marketplaces e sofrendo perda de desempenho.",
      notes: [
        "🎯 Ângulo: Guia anti-erro na compra de peças (Skill carousel-builder).",
        "🔥 Por que está em alta: Alta busca por compatibilidade de slots M.2 e medo de comprar peça errada.",
        "🖼️ Capa (Slide 1): 'SATA VS NVME: NÃO ERRE A PEÇA'",
        "📊 Estrutura Slide a Slide (Skill carousel-builder):\nSlide 1 [CAPA]: SSD SATA vs SSD NVMe: Qual o seu notebook realmente aceita sem travar?\n   🎨 Visual: Foto macro no laboratório comparando o SSD 2.5\" com o pente NVMe M.2.\n\nSlide 2 [CONTEUDO]: A diferença física e visual\n   SATA: Parece um HD fininho de 2.5\" com cabos. Máximo de 550 MB/s.\n   NVMe: Formato 'chiclete' que vai parafusado direto no slot M.2 da placa. Até 3.500+ MB/s.\n   🎨 Visual: Destaque no encaixe do conector M.2 com chave B ou M.\n\nSlide 3 [CONTEUDO]: O perigo dos marketplaces\n   Muitas placas-mãe têm o slot M.2, mas ele é apenas SATA (não aceita NVMe) ou PCIe limitado. Se comprar errado, não reconhece na BIOS.\n   🎨 Visual: Alerta de erro 'No Bootable Device'.\n\nSlide 4 [CHECKLIST]: O que a Trust Care recomenda\n   Para trabalho/estudo: SSD NVMe Kingston/Crucial de 500GB a 1TB com garantia nacional de 3 a 5 anos.\n   🎨 Visual: Tabela comparativa com marcas confiáveis vs marcas genéricas perigosas.\n\nSlide 5 [CTA]: Verificação gratuita de compatibilidade\n   Mande o modelo exato da sua máquina no WhatsApp que a gente checa a placa-mãe para você.",
        "👉 CTA Final: 'Salve este post para consultar quando for escolher seu SSD.'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-carrossel-3",
      title: "42°C em Cuiabá: 4 sinais de que seu notebook está em perigo térmico",
      format: "carousel",
      pillar: "Prevenção",
      coverHeadline: "42°C: SEU NOTEBOOK AGUENTA?",
      emotionalAngle: "Alerta & Urgência Hiperlocal",
      viralPotential: "Extrema Viralização Regional",
      trendReason: "Onda de calor e seca em Cuiabá fazendo notebooks desligarem sozinhos durante o trabalho.",
      notes: [
        "🎯 Ângulo: Choque térmico e proteção de patrimônio em Cuiabá (Skill carousel-builder).",
        "🔥 Por que está em alta: No calor de Cuiabá, notebooks sem manutenção preventiva atingem 95°C em minutos.",
        "🖼️ Capa (Slide 1): '42°C: SEU NOTEBOOK AGUENTA?'",
        "📊 Estrutura Slide a Slide (Skill carousel-builder):\nSlide 1 [CAPA]: 42°C na sombra em Cuiabá: 4 sinais silenciosos de que seu notebook está pedindo socorro.\n   🎨 Visual: Imagem dramática com termômetro de Cuiabá e notebook na bancada.\n\nSlide 2 [CONTEUDO]: 1. Cooler em modo turbina o tempo todo\n   Se a ventoinha não para de girar no máximo mesmo só com o navegador aberto, a poeira de terra seca de MT já bloqueou as aletas.\n   🎨 Visual: Close no dissipador entupido com manta de poeira.\n\nSlide 3 [CONTEUDO]: 2. Teclado pelando e lentidão repentina (Throttling)\n   Para não queimar, o processador derruba a velocidade de 3.0 GHz para 0.79 GHz. É por isso que tudo trava.\n   🎨 Visual: Gráfico de temperatura em 92°C com clock do processador despencando.\n\nSlide 4 [CONTEUDO]: 3. Pasta térmica petrificada\n   A pasta original de fábrica seca em menos de 1 ano no clima de Cuiabá e vira uma camada isolante de calor.\n   🎨 Visual: Pasta térmica ressecada parecendo giz quebradiço.\n\nSlide 5 [CHECKLIST]: Prevenção que salva sua placa-mãe\n   Limpeza química profunda do cooler + troca de composto térmico de alto rendimento a cada 6 a 12 meses.\n   🎨 Visual: Antes e depois satisfatório da placa limpa.\n\nSlide 6 [CTA]: Não espere o notebook desligar no meio do trabalho\n   Agende sua manutenção preventiva pelo WhatsApp da Trust Care.",
        "👉 CTA Final: 'Seu notebook esquenta muito? Mande uma mensagem e agende sua revisão preventiva.'",
      ].join("\n\n"),
      test: false,
    },
  ],
  stories: [
    {
      ref: "ootto-stories-1",
      title: "O teste do ar-condicionado: Seu notebook só roda bem no quarto gelado?",
      format: "story",
      pillar: "Manutenção",
      interactivePoll: "Enquete: Seu note trava fora do ar-condicionado? (Sim! / Roda de boa)",
      emotionalAngle: "Identificação Regional & Alerta Térmico",
      viralPotential: "Alto Engajamento & Respostas de Story",
      trendReason: "No calor de Cuiabá, centenas de profissionais só conseguem trabalhar com ar-condicionado no 18°C.",
      notes: [
        "🎯 Ângulo: Teste prático do ar-condicionado em Cuiabá (Skill story-sequencer).",
        "🔥 Por que funciona nos Stories: Enquete inicial de sim/não aquece o algoritmo do Instagram e gera identificação imediata.",
        "📊 Sticker Interativo: Enquete no Quadro 1: 'Seu notebook só roda liso no ar-condicionado?' [Sim, ferve] vs [Roda de boa]",
        "📱 Sequência de 4 Quadros (Skill story-sequencer):\n\nQuadro 1 [GANCHO & ENQUETE]:\n   'O teste do ar-condicionado em Cuiabá: Seu notebook começa a travar ou queimar sua perna se você sai do ar gelado?'\n   🔘 Enquete: [Sim, ferve!] / [Roda de boa]\n   🎬 Filmagem: Vídeo de 4s mostrando o termômetro ou ar-condicionado e o notebook com cooler zumbindo.\n\nQuadro 2 [SINTOMA REAL]:\n   'Se você marcou sim, não é frescura do notebook: a pasta térmica secou e o cooler virou um tapete de poeira da nossa terra seca.'\n   🎬 Filmagem: Foto de bancada com seta apontando para a grade do cooler entupida com 'feltro' de poeira.\n\nQuadro 3 [PROVA TÉCNICA]:\n   'Olha o que a gente acabou de tirar desse Dell Inspiron aqui na bancada da Trust Care. Pasta térmica original ressecada que virou pedra!'\n   🎬 Filmagem: Vídeo curto de 5s com espátula raspando a pasta seca de fábrica e mostrando a limpeza química.\n\nQuadro 4 [THE TAP / CTA]:\n   'A limpeza preventiva sai por uma fração do preço de consertar uma placa queimada. Toque no sticker aqui embaixo e agende a sua para esta semana!'\n   🔘 Sticker: Link / Caixa 'Agendar no WhatsApp'",
        "👉 CTA Final: 'Toque no sticker de link para agendar sua preventiva na Trust Care.'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-stories-2",
      title: "R$ 450 vs R$ 3.800: Você jogaria este notebook no lixo?",
      format: "story",
      pillar: "Upgrades",
      interactivePoll: "Enquete: Gastar R$ 4.000 em um novo ou R$ 450 no seu? (Novo / Upgrade)",
      emotionalAngle: "Alívio Financeiro & Decisão Racional",
      viralPotential: "Alta Conversão de Directs",
      trendReason: "Dilema diário do consumidor: gastar muito num notebook novo frágil ou revitalizar a máquina atual.",
      notes: [
        "🎯 Ângulo: Economia real de R$ 3.000+ com upgrade na bancada (Skill story-sequencer).",
        "🔥 Por que funciona nos Stories: Contraste numérico brutal que faz o seguidor pensar antes de gastar.",
        "📊 Sticker Interativo: Enquete no Quadro 1: 'Gastar R$ 4.000 num novo ou R$ 450 pro seu voar?'",
        "📱 Sequência de 4 Quadros (Skill story-sequencer):\n\nQuadro 1 [GANCHO & ENQUETE]:\n   'Você prefere gastar R$ 4.000 em um notebook novo de plástico ou investir R$ 450 pro seu atual voar mais rápido que novo?'\n   🔘 Enquete: [Gastar 4 mil] / [Investir 450 e salvar]\n   🎬 Filmagem: Foto segurando um SSD NVMe e pente de memória ao lado de um notebook corporativo.\n\nQuadro 2 [O SINTOMA]:\n   'Esse cliente ia jogar fora esse ThinkPad porque demorava 2 minutos para abrir o Windows. O diagnóstico? Placa 100% perfeita, o gargalo era só o HD mecânico antigo.'\n   🎬 Filmagem: Vídeo de 4s mostrando o disco a 100% no Gerenciador de Tarefas.\n\nQuadro 3 [A TRANSFORMAÇÃO]:\n   'Colocamos SSD NVMe Kingston + 8GB RAM e limpeza química. Tempo de inicialização: caiu de 2 minutos para 8 segundos!'\n   🎬 Filmagem: Vídeo acelerado apertando o botão de ligar e a máquina entrando na área de trabalho instantaneamente.\n\nQuadro 4 [THE TAP / CAIXINHA]:\n   'Quer saber se o seu modelo ainda compensa o upgrade? Deixe o modelo dele aqui na caixinha que eu respondo hoje!'\n   🔘 Sticker: Caixinha de perguntas 'Qual o modelo do seu note?'",
        "👉 CTA Final: 'Deixe o modelo do seu aparelho na caixinha de perguntas para avaliarmos.'",
      ].join("\n\n"),
      test: false,
    },
    {
      ref: "ootto-stories-3",
      title: "Alerta de bancada: Touchpad levantando ou duro de clicar?",
      format: "story",
      pillar: "Prevenção",
      interactivePoll: "Enquete: O clique do seu touchpad está normal ou duro? (Normal / Estranho)",
      emotionalAngle: "Urgência & Prevenção de Danos Físicos",
      viralPotential: "Geração Imediata de Mensagens",
      trendReason: "Baterias de íon de lítio estufam no calor de Cuiabá e quebram a carcaça de notebooks de clientes desavisados.",
      notes: [
        "🎯 Ângulo: Alerta de segurança de bancada contra bateria estufada (Skill story-sequencer).",
        "🔥 Por que funciona nos Stories: O seguidor olha para o próprio notebook na hora para checar o touchpad.",
        "📊 Sticker Interativo: Enquete no Quadro 1: 'O clique do touchpad do seu notebook está macio ou parece travado?'",
        "📱 Sequência de 4 Quadros (Skill story-sequencer):\n\nQuadro 1 [GANCHO & ENQUETE]:\n   'Alerta rápido da bancada: o touchpad do seu notebook começou a ficar duro de clicar ou parece que tá levantando?'\n   🔘 Enquete: [Tá macio] / [Parece que estufou!]\n   🎬 Filmagem: Foto de perfil em ângulo rasante mostrando um touchpad levemente saltado da carcaça.\n\nQuadro 2 [O PERIGO]:\n   'Não force o clique! Isso acontece quando a bateria interna estufa por excesso de calor e pressão, empurrando o trackpad por baixo.'\n   🎬 Filmagem: Foto de alerta com a bateria parecendo uma almofada inflada dentro do chassi.\n\nQuadro 3 [A SOLUÇÃO]:\n   'Se você continuar usando, a carcaça racha e o touchpad quebra. Aqui na Trust Care removemos a bateria estufada com segurança e instalamos uma nova com garantia.'\n   🎬 Filmagem: Vídeo de 4s mostrando a peça nova sendo parafusada no alinhamento perfeito.\n\nQuadro 4 [THE TAP / DIRECT]:\n   'Acha que sua bateria estufou? Mande uma foto de lado no nosso direct que avaliamos na hora pra você.'\n   🔘 Sticker: Link / Direct 'Enviar foto no Direct'",
        "👉 CTA Final: 'Mande uma foto no direct da Trust Care para checarmos sua bateria com segurança.'",
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
      stories: "SEQUÊNCIAS DE STORIES (4 quadros) com enquetes interativas, dores de calor/lentidão de Cuiabá e direcionamento para Direct/WhatsApp.",
      calor_cuiaba: "Problemas causados pelo calor extremo de Cuiabá (40°C+) e poeira: superaquecimento, travamentos, pasta térmica ressecada e prevenção.",
      venda_notebooks: "Revenda de notebooks seminovos revisados com garantia e procedência na Trust Care versus comprar notebooks novos básicos caros.",
    };

    const isCarousel = focus === "carrosseis";
    const isStory = focus === "stories";
    const isReel = focus === "reels";

    if (isStory) {
      // Metodologia estrita da Skill story-sequencer (Ootto) com arco de 4 quadros e enquetes reais
      const storyPrompt = `Você é o Estrategista de Stories da Trust Care (assistência e revenda de notebooks em Cuiabá-MT), aplicando estritamente a skill Ootto "story-sequencer".
FOCO: 3 SEQUÊNCIAS DE STORIES (4 quadros por sequência) que constroem um arco narrativo de alta retenção e geram votos na enquete e mensagens no WhatsApp/Direct.
PILARES DISPONÍVEIS: ${pillarList || "Manutenção, Upgrades, Prevenção, Vendas, Dicas"}

DIRETRIZES DE ALTA PRECISÃO (ANTI-GENÉRICO & OOTTO):
1. ANCORAGEM REAL (2026): Proibido citar anos passados como presentes.
2. DADOS E NÚMEROS REAIS DE CUIABÁ: 42°C de calor, poeira avermelhada de MT nos coolers, pasta térmica de fábrica ressecada virando pedra, economia de R$ 3.000 em upgrades, baterias estufadas.
3. ESTRUTURA ESTRITA DE 4 QUADROS (Skill story-sequencer):
   - QUADRO 1 (Gancho & Interação): Frase curta provocativa + Enquete com as opções exatas de votação.
   - QUADRO 2 (Sintoma Real / Problema): Dor real vivida pelo cliente, com nota visual de bastidor.
   - QUADRO 3 (Prova Técnica de Bancada): Demonstração visual de autoridade da Trust Care (multímetro, pasta térmica nova, SSD NVMe).
   - QUADRO 4 (The Tap / CTA Único): Apenas UMA chamada no sticker de link, caixinha ou WhatsApp.
4. TEXTO CURTO E DINÂMICO: Frases diretas para leitura rápida de stories.
5. NOTA VISUAL DE FILMAGEM (What to shoot): Descreva exatamente o que filmar/fotografar na bancada.`;

      const storySchema = {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                format: { type: "string", enum: ["story"] },
                pillar: { type: "string" },
                interactivePoll: { type: "string" },
                emotionalAngle: { type: "string" },
                viralPotential: { type: "string" },
                trendReason: { type: "string" },
                frames: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      frameNumber: { type: "integer" },
                      role: { type: "string", enum: ["gancho_enquete", "sintoma", "solucao", "cta"] },
                      text: { type: "string" },
                      interactiveElement: { type: "string" },
                      shootNote: { type: "string" },
                    },
                    required: ["frameNumber", "role", "text", "interactiveElement", "shootNote"],
                  },
                },
                cta: { type: "string" },
              },
              required: [
                "title",
                "format",
                "pillar",
                "interactivePoll",
                "emotionalAngle",
                "viralPotential",
                "trendReason",
                "frames",
                "cta",
              ],
            },
          },
        },
        required: ["suggestions"],
      };

      const response = await withTimeout(
        ai.generateJson<{
          suggestions: Array<{
            title: string;
            format: "story";
            pillar: string;
            interactivePoll: string;
            emotionalAngle: string;
            viralPotential: string;
            trendReason: string;
            frames: Array<{
              frameNumber: number;
              role: string;
              text: string;
              interactiveElement: string;
              shootNote: string;
            }>;
            cta: string;
          }>;
        }>({
          system:
            "Você é o Story Sequencer da Trust Care em Cuiabá-MT, aplicando estritamente a skill story-sequencer do Ootto.",
          prompt: storyPrompt,
          schema: storySchema,
        }),
        12000,
      );

      const suggestions: AgentSuggestionView[] = (response.suggestions ?? []).map((s, idx) => ({
        ref: `ai-ootto-story-${Date.now()}-${idx}`,
        title: s.title,
        format: "story",
        pillar: s.pillar,
        interactivePoll: s.interactivePoll,
        emotionalAngle: s.emotionalAngle,
        viralPotential: s.viralPotential,
        trendReason: s.trendReason,
        notes: [
          `🎯 Ângulo: ${s.emotionalAngle} (${s.viralPotential})`,
          `🔥 Por que funciona nos Stories: ${s.trendReason}`,
          `📊 Sticker Interativo: ${s.interactivePoll}`,
          `📱 Sequência de 4 Quadros (Skill story-sequencer):\n\n` +
            (s.frames || [])
              .map(
                (fr) =>
                  `Quadro ${fr.frameNumber} [${fr.role.toUpperCase()}]:\n   "${fr.text}"\n   🔘 Sticker/Elemento: ${
                    fr.interactiveElement
                  }\n   🎬 Filmagem: ${fr.shootNote}`,
              )
              .join("\n\n"),
          `👉 CTA Final: ${s.cta}`,
        ].join("\n\n"),
        test: false,
      }));

      return ok(suggestions.length > 0 ? suggestions : FALLBACK_OOTTO_IDEAS.stories);
    }

    if (isCarousel) {
      // Metodologia estrita da Skill carousel-builder (Ootto) com hiper-especificidade e anti-genérico
      const carouselPrompt = `Você é o Estrategista Sênior de Carrosséis da Trust Care (assistência técnica e revenda de notebooks em Cuiabá-MT), aplicando estritamente a skill Ootto "carousel-builder".
FOCO: 3 CARROSSÉIS educativos, de quebra de objeções e comparativos técnicos de alto valor.
PILARES DISPONÍVEIS: ${pillarList || "Upgrades, Manutenção, Dicas, Prevenção, Vendas"}

DIRETRIZES DE ALTA PRECISÃO (ANTI-GENÉRICO):
1. ANCORAGEM REAL (ANO ATUAL: 2026): Nunca use anos passados como presentes.
2. DADOS E NÚMEROS REAIS: Use números concretos (ex: R$ 380 vs R$ 3.800 de um notebook novo; tempo de boot caindo de 1m45s para 8s; processador em thermal throttling caindo de 3.2 GHz para 0.79 GHz).
3. CONTEXTO HIPERLOCAL DE CUIABÁ: Calor de 42°C, poeira de terra seca de MT asfixiando o cooler, pasta térmica ressecada virando pedra.
4. COMPONENTES REAIS: SSD NVMe Gen3/Gen4, memórias RAM DDR4/DDR5 em dual-channel, pasta térmica de alta condutividade térmica, notebooks corporativos robustos (Dell Latitude, ThinkPad).
5. ESTRUTURA DOS SLIDES (Skill carousel-builder):
   - SLIDE 1 (Capa / Scroll-stopper): Headline audaciosa e magnética com MENOS DE 8 PALAVRAS. Ex: "ECONOMIZOU R$ 3.100 NÃO COMPRANDO NOVO", "A REGRA DOS 30% PARA UPGRADE".
   - SLIDES 2-N (Conteúdo denso e didático): Uma ideia por slide com headline em negrito, 2 a 3 linhas de explicação técnica simples e nota visual cirúrgica.
   - PENÚLTIMO SLIDE: Resumo visual, checklist ou tabela comparativa que a pessoa tira print para salvar na galeria.
   - ÚLTIMO SLIDE: Chamada de ação única para o WhatsApp ou Direct da Trust Care em Cuiabá.

PROIBIDO: Não mencione termos de vídeo/Reel ("segundos", "gancho falado 0-3s", "texto na tela 0-3s"). Isto é um post de CARROSSEL de imagens.`;

      const carouselSchema = {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                format: { type: "string", enum: ["carousel"] },
                pillar: { type: "string" },
                coverHeadline: { type: "string" },
                emotionalAngle: { type: "string" },
                viralPotential: { type: "string" },
                trendReason: { type: "string" },
                slides: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      slideNumber: { type: "integer" },
                      role: { type: "string", enum: ["capa", "conteudo", "checklist", "cta"] },
                      headline: { type: "string" },
                      supportingText: { type: "string" },
                      visualNote: { type: "string" },
                    },
                    required: ["slideNumber", "role", "headline", "visualNote"],
                  },
                },
                cta: { type: "string" },
              },
              required: [
                "title",
                "format",
                "pillar",
                "coverHeadline",
                "emotionalAngle",
                "viralPotential",
                "trendReason",
                "slides",
                "cta",
              ],
            },
          },
        },
        required: ["suggestions"],
      };

      const response = await withTimeout(
        ai.generateJson<{
          suggestions: Array<{
            title: string;
            format: "carousel";
            pillar: string;
            coverHeadline: string;
            emotionalAngle: string;
            viralPotential: string;
            trendReason: string;
            slides: Array<{
              slideNumber: number;
              role: "capa" | "conteudo" | "checklist" | "cta";
              headline: string;
              supportingText?: string;
              visualNote: string;
            }>;
            cta: string;
          }>;
        }>({
          system:
            "Você é o Carousel Writer da Trust Care em Cuiabá-MT, aplicando estritamente a skill carousel-builder do Ootto. Você NUNCA usa termos de vídeo/Reel para carrosséis.",
          prompt: carouselPrompt,
          schema: carouselSchema,
        }),
        12000,
      );

      const suggestions: AgentSuggestionView[] = (response.suggestions ?? []).map((s, idx) => ({
        ref: `ai-ootto-carousel-${Date.now()}-${idx}`,
        title: s.title,
        format: "carousel",
        pillar: s.pillar,
        coverHeadline: s.coverHeadline,
        emotionalAngle: s.emotionalAngle,
        viralPotential: s.viralPotential,
        trendReason: s.trendReason,
        notes: [
          `🎯 Ângulo: ${s.emotionalAngle} (${s.viralPotential})`,
          `🔥 Por que está em alta: ${s.trendReason}`,
          `🖼️ Capa (Slide 1): "${s.coverHeadline}"`,
          `📊 Roteiro Slide a Slide (Skill carousel-builder):\n` +
            (s.slides || [])
              .map(
                (sl) =>
                  `Slide ${sl.slideNumber} [${sl.role.toUpperCase()}]: ${sl.headline}${
                    sl.supportingText ? `\n   ${sl.supportingText}` : ""
                  }\n   🎨 Visual: ${sl.visualNote}`,
              )
              .join("\n\n"),
          `👉 CTA Final: ${s.cta}`,
        ].join("\n\n"),
        test: false,
      }));

      return ok(suggestions.length > 0 ? suggestions : FALLBACK_OOTTO_IDEAS.carrosseis);
    }

    // Para Reels e outros formatos
    const allowedFormats = isReel ? ["reel"] : ["reel", "carousel", "story"];
    const formatRule = isReel
      ? "3. FORMATO: OBRIGATORIAMENTE 'reel'. Todas as 5 ideias DEVEM ser vídeos curtos/reels gravados na bancada de assistência."
      : "3. FORMATO: Escolha entre 'reel', 'carousel' e 'story'.";

    const prompt = `Gere 5 ideias de conteúdo irresistíveis e hiper-específicas para o Instagram da Trust Care (assistência técnica e revenda de notebooks em Cuiabá-MT).

FOCO ATUAL: ${focusPrompts[focus]}
PILARES DISPONÍVEIS: ${pillarList || "Manutenção, Upgrades, Vendas, Dicas, Bastidores"}

DIRETRIZES DE ALTA PRECISÃO (ANTI-GENÉRICO & SKILLS OOTTO):
1. ANCORAGEM REAL (2026): Proibido citar anos passados como presentes.
2. NÚMEROS E PEÇAS CONCRETAS: Fale de valores em R$ (economia de R$ 2.500 vs notebook novo), temperaturas de Cuiabá (42°C+), componentes reais (SSD NVMe Kingston/Crucial, memória DDR4, pasta térmica de alta viscosidade, placas com capacitor em curto na linha de 19V).
3. TÍTULO / GANCHO (0-3s): Menos de 12 palavras, falado, quebra de padrão violenta, sem clichês.
4. TEXTO NA TELA: 3 a 5 palavras em caixa alta para a legenda visual inicial impactante.
${formatRule}
5. EMOTIONAL ANGLE: O trabalho emocional (ex: Alívio de gasto, Medo de queimar, Curiosidade técnica, Prova de autoridade).
6. VIRAL POTENTIAL: Estimativa real ('Viral', 'Alta Retenção', 'Conversão WhatsApp').
7. TREND REASON: O que torna este tema quente e urgente no momento.
8. HOOK SPOKEN: A frase falada exata dos primeiros 3 segundos.
9. STRUCTURE SUMMARY: Roteiro conciso de retenção de bancada com o passo a passo da gravação.
10. CTA: Chamada direta para o WhatsApp da Trust Care em Cuiabá.`;

    const schema = {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              format: { type: "string", enum: allowedFormats },
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

    const response = await withTimeout(
      ai.generateJson<{
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
      }),
      12000,
    );

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
