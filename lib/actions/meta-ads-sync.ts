"use server";

import { revalidatePath } from "next/cache";

import { getAiProvider } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import { getMetaAdsClient } from "@/lib/integrations/meta-ads/client";
import type { MetaRealAdSet } from "@/lib/integrations/meta-ads/types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

export type CampaignDiagnosticReport = {
  executive_summary: string;
  best_angle_name: string;
  recommended_actions: string[];
  budget_adjustment_suggestion: string;
  fatigued_creatives: string[];
  status_badge: "healthy" | "attention" | "optimizing";
};

async function getStoredMetaSettings(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("settings")
    .eq("user_id", userId)
    .single();

  const settings = (profile?.settings as Record<string, unknown>)?.meta_ads as
    | {
        ad_account_id?: string;
        access_token?: string;
        token_updated_at?: string;
        account_name?: string;
      }
    | undefined;

  return settings;
}

export async function getMetaAdsCredentials(): Promise<{
  adAccountId: string | null;
  accessTokenMasked: string | null;
  tokenUpdatedAt: string | null;
  accountName: string | null;
  isConfigured: boolean;
  isLive: boolean;
}> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const settings = await getStoredMetaSettings(supabase, user.id);

  const adAccountId = settings?.ad_account_id || process.env.META_AD_ACCOUNT_ID || null;
  const token = settings?.access_token || process.env.META_ACCESS_TOKEN || null;

  return {
    adAccountId,
    accessTokenMasked: token ? `${token.slice(0, 10)}...${token.slice(-6)}` : null,
    tokenUpdatedAt: settings?.token_updated_at || null,
    accountName: settings?.account_name || null,
    isConfigured: Boolean(adAccountId && token),
    isLive: Boolean(adAccountId && token),
  };
}

export type MetaAdAccountOption = {
  id: string;
  name: string;
  isRecommended: boolean;
};

export async function listMetaAdAccounts(
  customToken?: string
): Promise<ActionResult<MetaAdAccountOption[]>> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const stored = await getStoredMetaSettings(supabase, user.id);
  const token = customToken?.trim() || stored?.access_token || process.env.META_ACCESS_TOKEN || "";

  if (!token) {
    return fail("Nenhum token de acesso disponível. Cole o token gerado no Explorador da Meta.");
  }

  const accounts: MetaAdAccountOption[] = [];
  const seenIds = new Set<string>();

  const addAccount = (rawId: string, name: string) => {
    const formattedId = rawId.startsWith("act_") ? rawId : `act_${rawId.replace(/^act=?/i, "")}`;
    if (!seenIds.has(formattedId)) {
      seenIds.add(formattedId);
      const isRecommended = /trust|care/i.test(name);
      accounts.push({
        id: formattedId,
        name,
        isRecommended,
      });
    }
  };

  // 1. Consulta contas diretas em /me/adaccounts
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,account_status&limit=50&access_token=${encodeURIComponent(token)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    const json = await res.json();
    if (json.error) {
      return fail(`Erro da Meta ao listar contas: ${json.error.message}`);
    }
    if (Array.isArray(json.data)) {
      for (const item of json.data) {
        if (item.id) addAccount(item.id, item.name || "Conta Meta");
      }
    }
  } catch (err) {
    console.warn("Erro ao buscar /me/adaccounts:", err);
  }

  // 2. Consulta contas vinculadas via Gerenciador de Negócios (/me/businesses)
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me/businesses?fields=id,name,owned_ad_accounts{id,name},client_ad_accounts{id,name}&limit=25&access_token=${encodeURIComponent(token)}`,
      { headers: { Accept: "application/json" }, cache: "no-store" }
    );
    const json = await res.json();
    if (Array.isArray(json.data)) {
      for (const biz of json.data) {
        if (Array.isArray(biz.owned_ad_accounts?.data)) {
          for (const item of biz.owned_ad_accounts.data) {
            if (item.id) addAccount(item.id, item.name || "Conta Empresa");
          }
        }
        if (Array.isArray(biz.client_ad_accounts?.data)) {
          for (const item of biz.client_ad_accounts.data) {
            if (item.id) addAccount(item.id, item.name || "Conta Cliente");
          }
        }
      }
    }
  } catch (bizErr) {
    console.warn("Erro ao buscar /me/businesses:", bizErr);
  }

  // Ordena para colocar as contas da Trust Care no topo
  accounts.sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return a.name.localeCompare(b.name);
  });

  return ok(accounts);
}

export async function saveMetaAdsCredentials(input: {
  adAccountId: string;
  accessToken?: string;
}): Promise<ActionResult<{ accountName?: string }>> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const existingSettings = await getStoredMetaSettings(supabase, user.id);

  const rawId = input.adAccountId.trim();
  const adAccountId = rawId.startsWith("act_") ? rawId : `act_${rawId.replace(/^act=?/i, "")}`;
  const accessToken = input.accessToken?.trim() || existingSettings?.access_token || process.env.META_ACCESS_TOKEN || "";

  if (!adAccountId || adAccountId.length < 5) return fail("ID da conta de anúncios inválido (ex.: act_1671912470896313).");
  if (!accessToken || accessToken.length < 20) return fail("Token de acesso inválido ou expirado. Cole um novo token gerado.");

  // Validação ao vivo na Graph API da Meta
  try {
    const testUrl = `https://graph.facebook.com/v21.0/${adAccountId}?fields=name,account_status,currency&access_token=${accessToken}`;
    const testRes = await fetch(testUrl, { headers: { Accept: "application/json" } });
    const testJson = await testRes.json();

    if (!testRes.ok || testJson.error) {
      const msg = testJson.error?.message || "Não foi possível validar a conta na Meta.";
      return fail(`A Meta rejeitou o acesso à conta ${adAccountId}: ${msg}`);
    }

    const accountName = testJson.name || "Conta Trust Care Meta Ads";

    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("settings")
      .eq("user_id", user.id)
      .single();

    const currentSettings = (currentProfile?.settings as Record<string, unknown>) || {};
    const newSettings = {
      ...currentSettings,
      meta_ads: {
        ad_account_id: adAccountId,
        access_token: accessToken,
        token_updated_at: new Date().toISOString(),
        account_name: accountName,
      },
    };

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: user.id, settings: newSettings });

    if (error) return fail("Erro ao salvar no banco de dados.");

    revalidatePath("/", "layout");
    return ok({ accountName });
  } catch (err) {
    console.error("Erro ao testar credenciais da Meta:", err);
    return fail("Erro ao conectar à API da Meta. Verifique o token e tente novamente.");
  }
}

export async function getStoredMetaAdSets(): Promise<MetaRealAdSet[]> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const metaSettings = await getStoredMetaSettings(supabase, user.id);
  const metaClient = getMetaAdsClient(metaSettings);
  try {
    return await metaClient.getAdSets();
  } catch {
    return [];
  }
}

/**
 * Busca campanhas, conjuntos de anúncios, anúncios e métricas diretamente da Meta Graph API,
 * grava no banco e atualiza os caches dos ângulos correspondentes.
 */
export async function syncMetaAdsMetrics(campaignId?: string): Promise<ActionResult<{ syncedCount: number; message?: string }>> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const metaSettings = await getStoredMetaSettings(supabase, user.id);

  if (!metaSettings?.access_token || !metaSettings?.ad_account_id) {
    return fail("Credenciais do Meta Ads não configuradas. Clique em 'Atualizar Token' para conectar a sua conta.");
  }

  const metaClient = getMetaAdsClient(metaSettings);

  // 0. Remove dados simulados de teste antigos caso existam
  try {
    await supabase.from("marketing_campaigns").delete().eq("meta_campaign_id", "meta_camp_tc_upgrade");
    await supabase.from("campaign_angles").delete().in("meta_ad_id", ["meta_ad_dor_pc_lento", "meta_ad_custo_beneficio"]);
    await supabase.from("meta_ads_metrics").delete().eq("meta_campaign_id", "meta_camp_tc_upgrade");
  } catch (cleanErr) {
    console.warn("Aviso ao limpar dados antigos:", cleanErr);
  }

  // 1. Consulta campanhas e conjuntos na Meta Graph API
  let remoteCampaigns: Awaited<ReturnType<typeof metaClient.getCampaigns>> = [];
  try {
    remoteCampaigns = await metaClient.getCampaigns();
  } catch (err) {
    console.error("Erro ao consultar campanhas da Meta:", err);
    return fail(`Erro da Meta API: ${(err as Error).message}`);
  }

  let remoteAdSets: Awaited<ReturnType<typeof metaClient.getAdSets>> = [];
  try {
    remoteAdSets = await metaClient.getAdSets(campaignId);
  } catch (adSetErr) {
    console.warn("Aviso ao buscar conjuntos de anúncios:", adSetErr);
  }

  const adsetMap = new Map<string, string>();
  for (const s of remoteAdSets) {
    adsetMap.set(s.id, s.name);
  }

  // Descobre a pasta da Diretoria de Marketing (Trust Care)
  const { data: area } = await supabase.from("areas").select("id").eq("slug", "trustcare").maybeSingle();
  const { data: folder } = area
    ? await supabase.from("folders").select("id").eq("area_id", area.id).eq("module", "marketing_director").maybeSingle()
    : { data: null };
  const folderId = folder?.id || null;

  let syncedCampaignsCount = 0;
  let syncedAdsCount = 0;

  // 2. Se houver campanhas na Meta, faz o upsert
  if (remoteCampaigns.length > 0) {
    for (const rc of remoteCampaigns) {
      if (campaignId && rc.id !== campaignId) continue;

      const { data: existingCamp } = await supabase
        .from("marketing_campaigns")
        .select("id")
        .eq("meta_campaign_id", rc.id)
        .maybeSingle();

      let campaignDbId: string;
      const rawStatus = (rc.status || "").toLowerCase();
      const validStatus = ["active", "paused", "archived", "completed", "draft", "scheduled"].includes(rawStatus)
        ? rawStatus
        : "paused";

      const campPayload = {
        name: rc.name,
        status: validStatus,
        objective: rc.objective?.toLowerCase().includes("lead") ? "whatsapp_leads" : "whatsapp_leads",
        budget_daily_cents: rc.daily_budget_cents ?? 0,
        budget_total_cents: rc.lifetime_budget_cents ?? 0,
        start_date: rc.start_time ? rc.start_time.slice(0, 10) : new Date().toISOString().slice(0, 10),
        meta_campaign_id: rc.id,
        folder_id: folderId,
        user_id: user.id,
      };

      if (existingCamp) {
        await supabase.from("marketing_campaigns").update(campPayload).eq("id", existingCamp.id);
        campaignDbId = existingCamp.id;
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("marketing_campaigns")
          .insert(campPayload)
          .select("id")
          .single();

        if (insertErr || !inserted) {
          console.error("Erro ao inserir campanha sincronizada:", insertErr);
          continue;
        }
        campaignDbId = inserted.id;
      }
      syncedCampaignsCount++;

      // Busca anúncios reais desta campanha na Meta
      try {
        const remoteAds = await metaClient.getAds(rc.id);
        for (const ad of remoteAds) {
          const { data: existingAngle } = await supabase
            .from("campaign_angles")
            .select("id")
            .eq("meta_ad_id", ad.id)
            .maybeSingle();

          const adsetName = ad.adset_id ? adsetMap.get(ad.adset_id) || "Conjunto de Anúncios" : null;

          const anglePayload = {
            campaign_id: campaignDbId,
            title: ad.name,
            headline: ad.title || ad.name,
            body_copy: ad.body || "",
            meta_ad_id: ad.id,
            status: ad.status === "active" ? "testing" : "paused",
            user_id: user.id,
            metrics_cached: {
              adset_id: ad.adset_id || null,
              adset_name: adsetName,
            },
          };

          if (existingAngle) {
            await supabase.from("campaign_angles").update(anglePayload).eq("id", existingAngle.id);
          } else {
            await supabase.from("campaign_angles").insert(anglePayload);
          }
          syncedAdsCount++;
        }
      } catch (adErr) {
        console.warn(`Não foi possível carregar anúncios da campanha ${rc.id}:`, adErr);
      }
    }
  }

  // 3. Busca métricas e insights da Meta a nível de campanha e a nível de anúncio
  const allInsights: Awaited<ReturnType<typeof metaClient.getCampaignInsights>> = [];
  try {
    const campaignInsights = await metaClient.getCampaignInsights({
      campaignId,
      level: "campaign",
    });
    allInsights.push(...campaignInsights);
  } catch (insightErr) {
    console.warn("Aviso ao buscar insights a nível de campanha:", insightErr);
  }

  try {
    const adInsights = await metaClient.getCampaignInsights({
      campaignId,
      level: "ad",
    });
    allInsights.push(...adInsights);
  } catch (adInsightErr) {
    console.warn("Aviso ao buscar insights a nível de anúncio:", adInsightErr);
  }

  let metricsInserted = 0;
  if (allInsights.length > 0) {
    for (const insight of allInsights) {
      const { data: camp } = await supabase
        .from("marketing_campaigns")
        .select("id")
        .eq("meta_campaign_id", insight.campaign_id)
        .maybeSingle();

      const { data: angle } = insight.ad_id
        ? await supabase
            .from("campaign_angles")
            .select("id")
            .eq("meta_ad_id", insight.ad_id)
            .maybeSingle()
        : { data: null };

      await supabase.from("meta_ads_metrics").insert({
        user_id: user.id,
        campaign_id: camp?.id || null,
        meta_campaign_id: insight.campaign_id,
        meta_ad_id: insight.ad_id,
        date_reported: insight.date_reported,
        spend_cents: insight.spend_cents,
        impressions: insight.impressions,
        clicks: insight.clicks,
        ctr: insight.ctr,
        cpc_cents: insight.cpc_cents,
        conversions: insight.conversions,
        cost_per_conversion_cents: insight.cost_per_conversion_cents,
        raw_data: {
          synced_via: metaClient.name,
          ad_name: insight.ad_name,
          campaign_name: insight.campaign_name,
        },
      });

      if (angle) {
        await supabase
          .from("campaign_angles")
          .update({
            metrics_cached: {
              spend_cents: insight.spend_cents,
              impressions: insight.impressions,
              clicks: insight.clicks,
              ctr: insight.ctr,
              cpc_cents: insight.cpc_cents,
              leads: insight.conversions,
              conversions: insight.conversions,
              cpl_cents: insight.cost_per_conversion_cents,
              last_synced: insight.date_reported,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", angle.id);
      }

      metricsInserted++;
    }
  }

  revalidatePath("/marketing");
  revalidatePath("/", "layout");

  if (remoteCampaigns.length === 0) {
    return ok({
      syncedCount: 0,
      message: "Conta conectada com sucesso! Nenhuma campanha cadastrada foi encontrada nesta conta de anúncios na Meta.",
    });
  }

  return ok({
    syncedCount: metricsInserted || syncedCampaignsCount,
    message: `${syncedCampaignsCount} campanhas e ${syncedAdsCount} anúncios sincronizados da Meta.`,
  });
}

/**
 * Análise consultiva com IA a partir de métricas consolidadas reais.
 */
export async function analyzeCampaignsWithAi(data?: {
  totalSpendCents: number;
  totalClicks: number;
  totalLeads: number;
  avgCtr: number;
  topAngleTitle?: string | null;
}): Promise<ActionResult<CampaignDiagnosticReport>> {
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

  const spendCents = data?.totalSpendCents ?? 0;
  const clicks = data?.totalClicks ?? 0;
  const leads = data?.totalLeads ?? 0;
  const ctr = data?.avgCtr ?? 0;
  const cplCents = leads > 0 ? Math.round(spendCents / leads) : 0;
  const topAngle = data?.topAngleTitle || null;

  const isZeroSpend = spendCents === 0 && clicks === 0;

  try {
    const ai = getAiProvider();

    const prompt = isZeroSpend
      ? `Você é Pedro Sobral — o maior especialista em tráfego pago do Brasil, mentor de mais de 40 mil gestores na Comunidade Subido.
Você está prestando consultoria estratégica para o Luan, proprietário da Trust Care (assistência técnica de notebooks, MacBooks e computadores em Cuiabá e Várzea Grande - MT).

CENÁRIO ATUAL:
A conta do Meta Ads está conectada, mas NÃO possui campanhas veiculando ou gastos registrados nos últimos 30 dias (Gasto: R$ 0,00, Cliques: 0, Leads: 0, CTR: 0,00%).

DIRETRIZES DE PEDRO SOBRAL:
1. "Vai lá e faz." Sem teoria vazia. Jedi vai pro campo de batalha e executa; Padawan só consome conteúdo e procrastina.
2. "Criativo é o novo público." Em negócios locais, o gancho do vídeo (bancada da assistência, problema do notebook) atrai o cliente certo melhor que segmentação complexa de interesses.
3. "Cada centavo investido é um teste."
4. Campanha inicial em ABO (orçamento no conjunto) com foco direto em Mensagens de WhatsApp.

Gere o Parecer de Ativação no seu estilo característico:
1. Resumo executivo em 2 a 3 frases enérgicas, convocando o Luan a tirar o primeiro anúncio do papel hoje ("Vai lá e faz!").
2. Nome do primeiro ângulo inaugural para testar (ex.: 'Vídeo Bancada: Notebook Travando no Home Office - Troca de SSD em Cuiabá').
3. 3 ações práticas de tráfego para executar no Gerenciador de Anúncios esta semana.
4. Sugestão de orçamento diário inicial para teste (ex.: R$ 20,00 a R$ 25,00/dia em ABO).
5. Alerta do "Problema da Raposa" (não confiar cegamente em recomendações automáticas da Meta e garantir que o número de WhatsApp e raio de 15km de Cuiabá estejam calibrados).
6. Status: "attention" (pois a conta ainda precisa ser ativada).`
      : `Você é Pedro Sobral — o maior especialista em tráfego pago do Brasil, mentor da Comunidade Subido.
Você está analisando os dados REAIS de tráfego pago da Trust Care em Cuiabá e Várzea Grande:

DADOS REAIS DA CONTA:
- Gasto acumulado: R$ ${(spendCents / 100).toFixed(2)}
- Total de cliques para WhatsApp: ${clicks}
- Mensagens / Leads iniciados: ${leads}
- CTR médio no link: ${ctr.toFixed(2)}%
- Custo por Lead (CPL): R$ ${(cplCents / 100).toFixed(2)}
- Melhor ângulo testado: "${topAngle || "Campanha Geral"}"

METODOLOGIA SOBRAL APLICADA:
1. "Criativo é o novo público." Avalie se os criativos estão falando a dor real de quem tem PC/notebook estragado.
2. "Cada centavo é um teste." Compare o CPL de R$ ${(cplCents / 100).toFixed(2)} com o ticket de serviços de informática em Cuiabá (upgrade de SSD R$ 250-450, reparo de dobradiça R$ 180-350, placa mãe R$ 350-800).
3. "Estratégia do Passo Anterior": como usar públicos mornos (engajamento de Instagram) para baratear o custo por mensagem.
4. "Problema da Raposa": cortar o que não gera mensagem real e escalar apenas o criativo vencedor em CBO.

Forneça seu parecer executivo:
1. Resumo executivo em 2 a 3 frases diretas, avaliando o ROI e a eficiência do tráfego.
2. Nome do ângulo com maior potencial de escala.
3. 3 ações cirúrgicas que o Luan deve executar no Gerenciador esta semana.
4. Sugestão clara de verba (quando subir o orçamento no conjunto vencedor ou testar novos ganchos).
5. Alerta de fadiga criativa ou saturação de público em Cuiabá.
6. Status geral: healthy, attention ou optimizing.`;

    const report = await ai.generateJson<CampaignDiagnosticReport>({
      system:
        "Você é Pedro Sobral — O Ninja do Tráfego Pago. Use sua metodologia consagrada ('Vai lá e faz', 'Criativo é o novo público', 'Cada centavo é um teste', 'Estratégia do Passo Anterior'). Seja direto, enérgico, pragmático e 100% focado no lucro da assistência técnica em Cuiabá.",
      prompt,
      schema: {
        type: "object",
        properties: {
          executive_summary: { type: "string" },
          best_angle_name: { type: "string" },
          recommended_actions: { type: "array", items: { type: "string" } },
          budget_adjustment_suggestion: { type: "string" },
          fatigued_creatives: { type: "array", items: { type: "string" } },
          status_badge: { type: "string", enum: ["healthy", "attention", "optimizing"] },
        },
        required: [
          "executive_summary",
          "best_angle_name",
          "recommended_actions",
          "budget_adjustment_suggestion",
          "fatigued_creatives",
          "status_badge",
        ],
      },
    });

    return ok(report);
  } catch (err) {
    console.error("Erro na geração com IA:", err);
    if (isZeroSpend) {
      return ok({
        executive_summary:
          "Sua conta do Meta Ads está pronta, mas enquanto o anúncio não estiver rodando você é um Padawan que sabe a teoria mas não executa. Jedi vai lá e faz: coloque a primeira campanha de WhatsApp no ar hoje mesmo em Cuiabá!",
        best_angle_name: "Vídeo Reel Bancada: Dobradiça Quebrada ou Notebook Travando",
        recommended_actions: [
          "Subir 1 campanha ABO com objetivo direto de Mensagens no WhatsApp da Trust Care.",
          "Gravar na própria bancada um vídeo vertical de 30 a 45 segundos mostrando um notebook sendo consertado.",
          "Segmentar para pessoas em Cuiabá e Várzea Grande em raio de 15km sem restringir interesses (deixe o criativo filtrar).",
        ],
        budget_adjustment_suggestion:
          "Iniciar com R$ 20,00/dia no conjunto de teste. Cada centavo é um teste, avalie os primeiros 5 a 7 dias.",
        fatigued_creatives: [
          "Nenhum anúncio fadigado ainda (hora de destravar a primeira veiculação).",
        ],
        status_badge: "attention",
      });
    }

    return ok({
      executive_summary: `Investimento acumulado de R$ ${(spendCents / 100).toFixed(2)} com CPL de R$ ${(cplCents / 100).toFixed(2)} por mensagem iniciada. O tráfego local da Trust Care está gerando oportunidade real de bancada.`,
      best_angle_name: topAngle || "Campanha Principal Trust Care (Cuiabá)",
      recommended_actions: [
        "Dobrar a velocidade de resposta no WhatsApp: lead quente não espera mais de 5 minutos.",
        "Pausar anúncios com frequência acima de 3.0 para o público local de Cuiabá e VG.",
        "Produzir 2 novas variações de gancho para o criativo vencedor (Criativo é o novo público).",
      ],
      budget_adjustment_suggestion: "Aumentar a verba do conjunto vencedor em 20% a cada 3 dias enquanto o CPL se mantiver saudável.",
      fatigued_creatives: ["Monitore a frequência no público local para evitar saturação da marca."],
      status_badge: "optimizing",
    });
  }
}

/**
 * Aciona o Gemini para analisar os KPIs reais (Spend, CTR, CPC, Leads, CPL)
 * de uma campanha específica ou de todas as campanhas, gerando o parecer executivo.
 */
export async function generateAiAdsDiagnostics(campaignId?: string): Promise<ActionResult<CampaignDiagnosticReport>> {
  await getCurrentUser();
  const supabase = await createClient();

  let metricsQuery = supabase
    .from("meta_ads_metrics")
    .select("spend_cents, clicks, conversions, ctr, impressions")
    .order("date_reported", { ascending: false })
    .limit(60);

  if (campaignId) {
    metricsQuery = metricsQuery.eq("campaign_id", campaignId);
  }

  const { data: metrics } = await metricsQuery;

  const totalSpendCents = (metrics ?? []).reduce((acc, m) => acc + m.spend_cents, 0);
  const totalClicks = (metrics ?? []).reduce((acc, m) => acc + m.clicks, 0);
  const totalLeads = (metrics ?? []).reduce((acc, m) => acc + m.conversions, 0);
  const totalImpressions = (metrics ?? []).reduce((acc, m) => acc + m.impressions, 0);
  const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;

  let anglesQuery = supabase.from("campaign_angles").select("title, status").is("deleted_at", null);
  if (campaignId) {
    anglesQuery = anglesQuery.eq("campaign_id", campaignId);
  }
  const { data: angles } = await anglesQuery;
  const winnerAngle = angles?.find((a) => a.status === "winner")?.title || angles?.[0]?.title || null;

  return analyzeCampaignsWithAi({
    totalSpendCents,
    totalClicks,
    totalLeads,
    avgCtr,
    topAngleTitle: winnerAngle,
  });
}
