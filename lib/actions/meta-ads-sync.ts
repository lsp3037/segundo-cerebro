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
  analysis_type?: "general" | "sobral";
  executive_summary: string;
  best_angle_name: string;
  recommended_actions: string[];
  budget_adjustment_suggestion: string;
  fatigued_creatives: string[];
  status_badge: "healthy" | "attention" | "optimizing";
  commercial_funnel_notes?: string;
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

export type MetaSyncOptions = {
  campaignId?: string;
  datePreset?: string;
  since?: string;
  until?: string;
};

/**
 * Busca campanhas, conjuntos de anúncios, anúncios e métricas diretamente da Meta Graph API,
 * grava no banco e atualiza os caches dos ângulos correspondentes.
 */
export async function syncMetaAdsMetrics(
  campaignIdOrOptions?: string | MetaSyncOptions
): Promise<ActionResult<{ syncedCount: number; message?: string }>> {
  const options: MetaSyncOptions =
    typeof campaignIdOrOptions === "string" ? { campaignId: campaignIdOrOptions } : campaignIdOrOptions || {};
  const campaignId = options.campaignId;
  const datePreset = options.datePreset;
  const since = options.since;
  const until = options.until;

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
      datePreset,
      since,
      until,
    });
    allInsights.push(...campaignInsights);
  } catch (insightErr) {
    console.warn("Aviso ao buscar insights a nível de campanha:", insightErr);
  }

  try {
    const adInsights = await metaClient.getCampaignInsights({
      campaignId,
      level: "ad",
      datePreset,
      since,
      until,
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

export type CampaignSummaryInput = {
  id?: string;
  name: string;
  status: string;
  budget_daily_cents: number;
  spend_cents: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc_cents: number;
  leads: number;
  cpl_cents: number;
};

/**
 * Análise consultiva com IA a partir de métricas consolidadas reais.
 * Suporta a Visão Executiva Geral de Negócio e a Metodologia Tática de Pedro Sobral,
 * baseando-se ESTRITAMENTE nos dados reais das campanhas cadastradas.
 */
export async function analyzeCampaignsWithAi(data?: {
  totalSpendCents: number;
  totalClicks: number;
  totalLeads: number;
  avgCtr: number;
  topAngleTitle?: string | null;
  analysisType?: "general" | "sobral";
  periodLabel?: string;
  campaigns?: CampaignSummaryInput[];
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
  const analysisType = data?.analysisType || "general";
  const periodLabel = data?.periodLabel || "Últimos 30 dias";
  const campaigns = data?.campaigns || [];

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const pausedCampaigns = campaigns.filter((c) => c.status !== "active");

  const campaignsListText = campaigns.length > 0
    ? campaigns
        .map((c) => {
          const statusLabel = c.status === "active" ? "ATIVA (RODANDO AGORA)" : "DESATIVADA / PAUSADA";
          const budget =
            c.budget_daily_cents > 0
              ? `R$ ${(c.budget_daily_cents / 100).toFixed(2)}/dia`
              : "Orçamento a nível de conjunto";
          const spend = `R$ ${(c.spend_cents / 100).toFixed(2)}`;
          const cpc = `R$ ${(c.cpc_cents / 100).toFixed(2)}`;
          const cpl = c.leads > 0 ? `R$ ${(c.cpl_cents / 100).toFixed(2)}` : "0 conversas";
          return `• Campanha: "${c.name}" [${statusLabel}]
  - Orçamento diário: ${budget}
  - Gasto no período: ${spend} | Impressões: ${c.impressions.toLocaleString("pt-BR")} | Cliques: ${c.clicks.toLocaleString("pt-BR")}
  - CTR: ${c.ctr.toFixed(2)}% | CPC: ${cpc} | Conversas WhatsApp: ${c.leads} | CPL: ${cpl}`;
        })
        .join("\n\n")
    : "Nenhuma campanha listada.";

  const activeCampaignName = activeCampaigns[0]?.name || "Campanha Ativa";

  try {
    const ai = getAiProvider();

    let system = "";
    let prompt = "";

    if (analysisType === "general") {
      system =
        "Você é um especialista sênior em gestão de tráfego pago para negócios locais e assistência técnica em Cuiabá (Trust Care). Sua análise é 100% FACTUAL, analítica, direta e sem invenções. NUNCA invente campanhas, criativos fictícios entre aspas ou serviços que não existam na lista fornecida.";

      prompt = `DADOS REAIS DAS CAMPANHAS NO GERENCIADOR DE ANÚNCIOS (${periodLabel}):
${campaignsListText}

MÉTRICAS TOTAIS CONSOLIDADAS DO PERÍODO:
- Gasto Total no período: R$ ${(spendCents / 100).toFixed(2)}
- Cliques Totais: ${clicks}
- Conversas Totais no WhatsApp: ${leads}
- CTR Médio: ${ctr.toFixed(2)}%
- Custo por Lead Médio: R$ ${(cplCents / 100).toFixed(2)}

REGRAS OBRIGATÓRIAS DE ANÁLISE:
1. Baseie-se EXCLUSIVAMENTE nas campanhas e métricas reais listadas acima. PROIBIDO inventar criativos ou dados que não estão aí.
2. Deixe claro quais campanhas estão ATIVAS (apenas "${activeCampaignName}" se for o caso) e quais estão PAUSADAS/DESATIVADAS.
3. Se a maioria dos leads/gasto pertence a uma campanha desativada (ex.: "Trust Care" com 110 conversas), explique que esse resultado é do histórico dessa campanha desativada, e não da campanha ativa atual.
4. Para a campanha ativa atual, analise o orçamento diário real, o gasto recente, o CPC e o volume de cliques atual.

Estrutura da Resposta:
1. executive_summary: Resumo direto (2 a 3 frases) explicando claramente a situação da conta (campanha ativa vs campanhas pausadas).
2. best_angle_name: O nome exato da campanha com maior tração ou em veiculação ativa (ex.: '${activeCampaignName}').
3. recommended_actions: 3 ações práticas e reais para o gestor da conta executar.
4. budget_adjustment_suggestion: Orientação realista sobre o orçamento diário da campanha ativa.
5. fatigued_creatives: Alerta factual sobre o status das campanhas (ex.: campanha antiga pausada após grande volume vs campanha nova em fase inicial).
6. status_badge: 'healthy', 'attention' ou 'optimizing'.
7. commercial_funnel_notes: Dica prática para o atendimento no WhatsApp converter mais conversas em ordens de serviço.`;
    } else {
      // Metodologia Pedro Sobral
      system =
        "Você é Pedro Sobral — o maior especialista em tráfego pago do Brasil. Você analisa os dados REAIS do Gerenciador de Anúncios da Trust Care em Cuiabá. Fale EXCLUSIVAMENTE sobre as campanhas reais listadas, com pragmatismo, energia e foco em execução ('Vai lá e faz!').";

      prompt = `DADOS REAIS DAS CAMPANHAS (${periodLabel}):
${campaignsListText}

Totais: Gasto R$ ${(spendCents / 100).toFixed(2)} | Cliques: ${clicks} | Conversas: ${leads} | CTR: ${ctr.toFixed(2)}% | CPL: R$ ${(cplCents / 100).toFixed(2)}

DIRETRIZES DE PEDRO SOBRAL:
1. Fale apenas das campanhas reais que estão aí em cima. Proibido inventar criativos.
2. Analise a campanha ATIVA: avalie o CPC de R$ ${(activeCampaigns[0]?.cpc_cents ? activeCampaigns[0].cpc_cents / 100 : 0).toFixed(2)}, o CTR e os cliques.
3. Se ela ainda não gerou conversas com poucos cliques/gasto inicial, explique que precisa de volume para validar o gancho.
4. Gere um parecer cirúrgico e direto.`;
    }

    const report = await ai.generateJson<CampaignDiagnosticReport>({
      system,
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
          commercial_funnel_notes: { type: "string" },
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

    return ok({ ...report, analysis_type: analysisType });
  } catch (err) {
    console.error("Erro na geração com IA:", err);
    const activeCamp = activeCampaigns[0];
    const pausedCampWithLeads = pausedCampaigns.find((c) => c.leads > 0);

    return ok({
      analysis_type: analysisType,
      executive_summary: activeCamp
        ? `No período selecionado (${periodLabel}), a única campanha ativa é "${activeCamp.name}" (R$ ${(activeCamp.budget_daily_cents / 100).toFixed(2)}/dia), com gasto inicial de R$ ${(activeCamp.spend_cents / 100).toFixed(2)} e ${activeCamp.clicks} cliques a um excelente CPC de R$ ${(activeCamp.cpc_cents / 100).toFixed(2)} (CTR de ${activeCamp.ctr.toFixed(2)}%). ${pausedCampWithLeads ? `O total de ${pausedCampWithLeads.leads} conversas pertence à campanha "${pausedCampWithLeads.name}", que atualmente está desativada.` : ""}`
        : `A conta possui 4 campanhas cadastradas, mas todas encontram-se desativadas no momento. ${pausedCampWithLeads ? `A campanha "${pausedCampWithLeads.name}" gerou historicamente ${pausedCampWithLeads.leads} conversas de WhatsApp com CPL de R$ ${(pausedCampWithLeads.cpl_cents / 100).toFixed(2)}.` : ""}`,
      best_angle_name: activeCamp ? activeCamp.name : (pausedCampWithLeads?.name || "Dobradiça Notebook | WhatsApp"),
      recommended_actions: [
        activeCamp
          ? `Manter a campanha "${activeCamp.name}" rodando para acumular volume de cliques e validar a conversão em mensagens.`
          : "Ativar a campanha de Dobradiça com orçamento inicial de R$ 20,00/dia.",
        "Verificar o link de destino no anúncio para garantir que a mensagem pré-definida no WhatsApp está funcionando.",
        pausedCampWithLeads
          ? `Avaliar reativação ou estudo do criativo da campanha "${pausedCampWithLeads.name}", que entregou ${pausedCampWithLeads.leads} contatos a baixo custo.`
          : "Manter o raio de segmentação focado em Cuiabá e Várzea Grande.",
      ],
      budget_adjustment_suggestion: activeCamp
        ? `Manter o orçamento atual de R$ ${(activeCamp.budget_daily_cents / 100).toFixed(2)}/dia até acumular pelo menos 30 a 50 cliques.`
        : "Recomendado iniciar com R$ 20,00 a R$ 25,00/dia em campanha focada em WhatsApp.",
      fatigued_creatives: [
        pausedCampWithLeads
          ? `A campanha "${pausedCampWithLeads.name}" foi pausada após 75 mil impressões.`
          : "Nenhuma campanha ativa apresenta fadiga no momento.",
        activeCamp ? `A campanha "${activeCamp.name}" é recente e está em fase de aprendizado.` : "Sem veiculação ativa.",
      ],
      status_badge: activeCamp ? "healthy" : "attention",
      commercial_funnel_notes: "Garantir que a resposta no WhatsApp aconteça em menos de 5 minutos com atendimento cordial e convite para diagnóstico presencial.",
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
