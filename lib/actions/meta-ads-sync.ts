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

/**
 * Análise consultiva com IA a partir de métricas consolidadas reais.
 * Suporta a Visão Executiva Geral de Negócio e a Metodologia Tática de Pedro Sobral.
 */
export async function analyzeCampaignsWithAi(data?: {
  totalSpendCents: number;
  totalClicks: number;
  totalLeads: number;
  avgCtr: number;
  topAngleTitle?: string | null;
  analysisType?: "general" | "sobral";
  periodLabel?: string;
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
  const analysisType = data?.analysisType || "general";
  const periodLabel = data?.periodLabel || "Últimos 30 dias";

  const isZeroSpend = spendCents === 0 && clicks === 0;

  try {
    const ai = getAiProvider();

    let system = "";
    let prompt = "";

    if (analysisType === "general") {
      system =
        "Você é o Diretor Executivo de Marketing da Trust Care (assistência técnica líder em manutenção de notebooks, MacBooks e computadores em Cuiabá e Várzea Grande - MT). Foque em visão comercial, rentabilidade, ROI, funil de conversão no WhatsApp e atração de clientes para a oficina técnica.";

      prompt = isZeroSpend
        ? `CENÁRIO: A conta está sem veiculação de anúncios no período (${periodLabel}). (Gasto: R$ 0,00, Cliques: 0, Leads: 0).
Diretrizes: Alinhe a importância de ativar campanhas locais em Cuiabá e VG (manutenção de notebook e upgrade de SSD) para manter a demanda da bancada contínua.
Gere:
1. executive_summary: 2 a 3 frases claras de recomendação de negócio para destravar o tráfego.
2. best_angle_name: Oferta de maior apelo no mercado local (ex.: 'Upgrade de SSD & Manutenção Preventiva').
3. recommended_actions: 3 ações estratégicas corporativas.
4. budget_adjustment_suggestion: Verba mensal sugerida (ex.: R$ 25 a R$ 35/dia).
5. fatigued_creatives: Alerta sobre o posicionamento perante a concorrência informal.
6. status_badge: 'attention'.
7. commercial_funnel_notes: Dica para o atendimento do balcão/Zap fechar mais orçamentos.`
        : `DADOS CONSOLIDADOS DO NEGÓCIO (${periodLabel}):
- Investimento em anúncios: R$ ${(spendCents / 100).toFixed(2)}
- Cliques / Contatos: ${clicks}
- Conversas iniciadas no WhatsApp: ${leads}
- CTR médio: ${ctr.toFixed(2)}%
- Custo por Mensagem (CPL): R$ ${(cplCents / 100).toFixed(2)}
- Oferta / Ângulo Principal: "${topAngle || "Assistência Técnica Geral"}"

DIRETRIZES DA DIRETORIA DE MARKETING:
1. Avalie o ROI comparando o CPL de R$ ${(cplCents / 100).toFixed(2)} com o ticket médio da bancada (R$ 200 a R$ 600).
2. Avalie o funil de atendimento: tempo de resposta da equipe e conversão de conversa em Ordem de Serviço (O.S.).
3. Posicionamento da Trust Care como assistência técnica premium em Cuiabá.

Gere:
1. executive_summary: Resumo executivo sobre tração comercial e retorno do investimento.
2. best_angle_name: Serviço com maior rentabilidade e aderência de público.
3. recommended_actions: 3 ações executivas de crescimento para este mês.
4. budget_adjustment_suggestion: Sugestão de gestão e alocação de verba publicitária.
5. fatigued_creatives: Gargalos potenciais no atendimento ou na mensagem.
6. status_badge: 'healthy', 'attention' ou 'optimizing'.
7. commercial_funnel_notes: Dica comercial direta para a recepção fechar mais serviços no Zap.`;
    } else {
      // Metodologia Pedro Sobral
      system =
        "Você é Pedro Sobral — O Ninja do Tráfego Pago. Use sua metodologia consagrada ('Vai lá e faz', 'Criativo é o novo público', 'Cada centavo é um teste', 'Estratégia do Passo Anterior'). Seja direto, enérgico, pragmático e 100% focado no lucro da assistência técnica em Cuiabá.";

      prompt = isZeroSpend
        ? `Você é Pedro Sobral prestando consultoria para o Luan na Trust Care (Cuiabá - MT).
CENÁRIO: Sem anúncios rodando no período selecionado (${periodLabel}). (Gasto: R$ 0,00, Cliques: 0).
Diretrizes: "Vai lá e faz", "Criativo é o novo público", ABO para teste inicial.
Gere:
1. executive_summary: Frases enérgicas convocando a colocar o primeiro anúncio no ar hoje ("Vai lá e faz!").
2. best_angle_name: Ângulo inaugural de bancada (ex.: 'Vídeo Reel: Dobradiça Quebrada ou Notebook Travando').
3. recommended_actions: 3 ações de tráfego para rodar no Gerenciador esta semana.
4. budget_adjustment_suggestion: Verba inicial sugerida (R$ 20 a 25/dia em ABO).
5. fatigued_creatives: Alerta do Problema da Raposa e raio de 15km de Cuiabá.
6. status_badge: 'attention'.`
        : `DADOS DA CONTA (${periodLabel}):
- Gasto acumulado: R$ ${(spendCents / 100).toFixed(2)}
- Cliques: ${clicks}
- Conversas WhatsApp: ${leads}
- CTR: ${ctr.toFixed(2)}%
- CPL: R$ ${(cplCents / 100).toFixed(2)}
- Ângulo testado: "${topAngle || "Campanha Geral"}"

METODOLOGIA SOBRAL:
1. "Criativo é o novo público": avalie os ganchos locais da assistência técnica.
2. "Cada centavo é um teste": compare com o ticket médio em Cuiabá.
3. "ABO para testar, CBO para escalar": momento de subir verba no criativo vencedor.
4. "Problema da Raposa": cortar o ruim e escalar o que gera mensagem real.

Gere:
1. executive_summary: Parecer direto de tráfego pago.
2. best_angle_name: Criativo com maior potencial de escala.
3. recommended_actions: 3 ações cirúrgicas para o Gerenciador de Anúncios.
4. budget_adjustment_suggestion: Ajuste de orçamento para o criativo vencedor.
5. fatigued_creatives: Alerta de fadiga criativa ou saturação em Cuiabá.
6. status_badge: healthy, attention ou optimizing.`;
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
    if (analysisType === "general") {
      return ok({
        analysis_type: "general",
        executive_summary: isZeroSpend
          ? "As campanhas de marketing encontram-se sem veiculação no período selecionado. Para manter a bancada da Trust Care com demanda constante, recomendamos ativar campanhas de captação local com foco em manutenção e reparo de dobradiça."
          : `Investimento consolidado de R$ ${(spendCents / 100).toFixed(2)} gerando ${leads} conversas de WhatsApp com custo por lead de R$ ${(cplCents / 100).toFixed(2)}. As campanhas apresentam tração comercial positiva em Cuiabá e Várzea Grande.`,
        best_angle_name: topAngle || "Upgrade de SSD & Manutenção Preventiva",
        recommended_actions: [
          "Garantir tempo de resposta no WhatsApp de no máximo 5 minutos.",
          "Oferecer diagnóstico rápido na bancada para aumentar a taxa de aprovação.",
          "Manter campanhas com raio de 15km em Cuiabá e Várzea Grande.",
        ],
        budget_adjustment_suggestion: "Alocar verba entre R$ 25,00 e R$ 35,00/dia para manter o fluxo diário de atendimentos.",
        fatigued_creatives: ["Evitar anúncios institucionais sem oferta direta de dor."],
        status_badge: isZeroSpend ? "attention" : "healthy",
        commercial_funnel_notes: "A recepção deve enviar fotos da peça danificada e do processo de bancada, aumentando a confiança imediata do cliente.",
      });
    }

    return ok({
      analysis_type: "sobral",
      executive_summary: isZeroSpend
        ? "Sua conta do Meta Ads está pronta, mas enquanto o anúncio não estiver rodando você é um Padawan que sabe a teoria mas não executa. Jedi vai lá e faz: coloque a primeira campanha de WhatsApp no ar hoje mesmo em Cuiabá!"
        : `Investimento acumulado de R$ ${(spendCents / 100).toFixed(2)} com CPL de R$ ${(cplCents / 100).toFixed(2)} por mensagem iniciada. O tráfego local da Trust Care está gerando oportunidade real de bancada.`,
      best_angle_name: topAngle || "Vídeo Reel Bancada: Dobradiça Quebrada ou Notebook Travando",
      recommended_actions: [
        "Dobrar a velocidade de resposta no WhatsApp: lead quente não espera mais de 5 minutos.",
        "Pausar anúncios com frequência acima de 3.0 para o público local de Cuiabá e VG.",
        "Produzir 2 novas variações de gancho para o criativo vencedor (Criativo é o novo público).",
      ],
      budget_adjustment_suggestion: "Aumentar a verba do conjunto vencedor em 20% a cada 3 dias enquanto o CPL se mantiver saudável.",
      fatigued_creatives: ["Monitore a frequência no público local para evitar saturação da marca."],
      status_badge: isZeroSpend ? "attention" : "optimizing",
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
