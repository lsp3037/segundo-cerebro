"use server";

import { revalidatePath } from "next/cache";

import { getAiProvider } from "@/lib/ai";
import { assertAreaAllowsAi } from "@/lib/ai/guard";
import { getCurrentUser } from "@/lib/auth";
import { getMetaAdsClient } from "@/lib/integrations/meta-ads/client";
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

export async function saveMetaAdsCredentials(input: {
  adAccountId: string;
  accessToken: string;
}): Promise<ActionResult<{ accountName?: string }>> {
  const user = await getCurrentUser();
  const rawId = input.adAccountId.trim();
  const adAccountId = rawId.startsWith("act_") ? rawId : `act_${rawId.replace(/^act=?/i, "")}`;
  const accessToken = input.accessToken.trim();

  if (!adAccountId || adAccountId.length < 5) return fail("ID da conta de anúncios inválido (ex.: act_1671912470896313).");
  if (!accessToken || accessToken.length < 20) return fail("Token de acesso inválido ou muito curto.");

  // Validação ao vivo na Graph API da Meta
  try {
    const testUrl = `https://graph.facebook.com/v21.0/${adAccountId}?fields=name,account_status,currency&access_token=${accessToken}`;
    const testRes = await fetch(testUrl, { headers: { Accept: "application/json" } });
    const testJson = await testRes.json();

    if (!testRes.ok || testJson.error) {
      const msg = testJson.error?.message || "Não foi possível validar o token na Meta.";
      return fail(`A Meta rejeitou o token: ${msg}`);
    }

    const accountName = testJson.name || "Conta Trust Care Meta Ads";

    const supabase = await createClient();
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

/**
 * Busca campanhas, anúncios e métricas diretamente da Meta Graph API,
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

  // 1. Consulta campanhas na Meta Graph API
  let remoteCampaigns: Awaited<ReturnType<typeof metaClient.getCampaigns>> = [];
  try {
    remoteCampaigns = await metaClient.getCampaigns();
  } catch (err) {
    console.error("Erro ao consultar campanhas da Meta:", err);
    return fail(`Erro da Meta API: ${(err as Error).message}`);
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
      const campPayload = {
        name: rc.name,
        status: rc.status === "active" ? "active" : "paused",
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

          const anglePayload = {
            campaign_id: campaignDbId,
            title: ad.name,
            headline: ad.title || ad.name,
            body_copy: ad.body || "",
            meta_ad_id: ad.id,
            status: ad.status === "active" ? "testing" : "paused",
            user_id: user.id,
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

  // 3. Busca métricas e insights da Meta
  let insights: Awaited<ReturnType<typeof metaClient.getCampaignInsights>> = [];
  try {
    insights = await metaClient.getCampaignInsights({
      campaignId: campaignId,
    });
  } catch (insightErr) {
    console.warn("Aviso ao buscar insights da Meta:", insightErr);
  }

  let metricsInserted = 0;
  if (insights.length > 0) {
    for (const insight of insights) {
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
  const topAngle = data?.topAngleTitle || null;

  const isZeroSpend = spendCents === 0 && clicks === 0;

  try {
    const ai = getAiProvider();

    const prompt = isZeroSpend
      ? `Você é o diretor de Growth e Tráfego Pago da Trust Care (assistência técnica de notebooks, MacBooks e computadores em Cuiabá e Várzea Grande - MT).
A conta do Meta Ads está conectada com sucesso (act_1671912470896313), mas NÃO possui campanhas veiculando ou gastos registrados nos últimos 30 dias (Gasto: R$ 0,00, Cliques: 0, Leads: 0, CTR: 0,00%).

Não invente métricas nem diga que houve cliques ou CTR.
Forneça um Diagnóstico Executivo de Prontidão e Ativação:
1. Resumo executivo em 2 a 3 frases afiadas, explicando que a conta está pronta para tráfego local em Cuiabá e o foco inicial deve ser colocar a primeira campanha no ar focada em mensagens no WhatsApp da Trust Care.
2. Nome do primeiro ângulo inaugural recomendado para iniciar os testes (ex.: 'Dor: Notebook Travando no Trabalho ou Home Office').
3. 3 ações práticas e imediatas para o Luan executar no Gerenciador da Meta.
4. Recomendação de verba diária inicial para a fase de testes em Cuiabá (ex.: R$ 20,00 a R$ 30,00/dia).
5. Alertas de criativo ou configuração antes de publicar.
6. Status: "attention" (pois a conta ainda não possui campanhas ativas gerando leads).`
      : `Você é o diretor de Growth e Tráfego Pago da Trust Care em Cuiabá e Várzea Grande.
Analise os seguintes resultados REAIS e consolidados das nossas campanhas no Meta Ads:
- Gasto acumulado: R$ ${(spendCents / 100).toFixed(2)}
- Total de cliques para WhatsApp: ${clicks}
- Mensagens / Leads iniciados: ${leads}
- CTR médio atual: ${ctr.toFixed(2)}%
- Melhor ângulo testado: "${topAngle || "Campanha Geral"}"

Forneça um parecer executivo com:
1. Resumo executivo em 2 a 3 frases afiadas e realistas baseadas EXCLUSIVAMENTE nesses números.
2. O nome do ângulo mais promissor ou melhor posicionado.
3. 3 ações recomendadas para o Luan executar esta semana.
4. Sugestão clara de realocação ou ajuste de verba.
5. Identificação de possíveis criativos fadigados ou gargalos.
6. Status geral: healthy, attention ou optimizing.`;

    const report = await ai.generateJson<CampaignDiagnosticReport>({
      system:
        "Você é um consultor sênior em Meta Ads e Growth para negócios locais de tecnologia em Cuiabá/VG. Seja extremamente prático, focado em ROI e custo por lead no WhatsApp. Nunca invente dados que contradigam os números fornecidos.",
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
          "Sua conta do Meta Ads está conectada com sucesso, mas ainda não há veiculações ativas ou gastos nos últimos 30 dias. O próximo passo é subir a primeira campanha de tráfego local focada no público de Cuiabá e Várzea Grande.",
        best_angle_name: "Dor & Urgência: Notebook Lento no Home Office",
        recommended_actions: [
          "Subir a primeira campanha com objetivo de Mensagens diretas no WhatsApp da Trust Care.",
          "Segmentar o público com raio de 15 a 20km em Cuiabá e Várzea Grande.",
          "Gravar na bancada um vídeo curto (Reel) mostrando o diagnóstico de lentidão e o resultado pós-upgrade.",
        ],
        budget_adjustment_suggestion:
          "Iniciar com verba de teste entre R$ 20,00 e R$ 25,00 por dia para validar o custo por conversa.",
        fatigued_creatives: [
          "Nenhum anúncio fadigado no momento (conta em fase inicial de ativação).",
        ],
        status_badge: "attention",
      });
    }

    return ok({
      executive_summary: `Investimento acumulado de R$ ${(spendCents / 100).toFixed(2)} com ${clicks} cliques e ${leads} conversões de WhatsApp. O canal local está ativo.`,
      best_angle_name: topAngle || "Campanha Principal Trust Care",
      recommended_actions: [
        "Acompanhar o tempo de resposta às mensagens iniciadas no WhatsApp.",
        "Pausar criativos com CTR em queda e frequência superior a 3.0.",
        "Produzir novas variações de ganchos em vídeo curto para Cuiabá.",
      ],
      budget_adjustment_suggestion: "Manter a verba atual enquanto o custo por mensagem estiver atrativo.",
      fatigued_creatives: ["Monitore criativos antigos para evitar saturação do público local."],
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
