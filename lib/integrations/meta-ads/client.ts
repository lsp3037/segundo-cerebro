import "server-only";

import { addDays, todayIso } from "@/lib/dates";
import type {
  MetaAdsCampaignInsight,
  MetaAdsClient,
  MetaRealAd,
  MetaRealAdSet,
  MetaRealCampaign,
} from "./types";

export function formatAdAccountId(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `act_${digits}`;
}

function mapRawInsight(item: Record<string, unknown>): MetaAdsCampaignInsight {
  const spendFloat = Number.parseFloat((item.spend as string) || "0");
  const spendCents = Math.round(spendFloat * 100);
  const impressions = Number.parseInt((item.impressions as string) || "0", 10);
  const clicks = Number.parseInt((item.clicks as string) || "0", 10);
  const ctr = Number.parseFloat((item.ctr as string) || "0");
  const cpcFloat = Number.parseFloat((item.cpc as string) || "0");
  const cpcCents = Math.round(cpcFloat * 100);

  let conversions = 0;
  if (Array.isArray(item.actions)) {
    for (const act of item.actions) {
      const type = act.action_type as string;
      if (
        type === "onsite_conversion.messaging_conversation_started_7d" ||
        type === "onsite_conversion.messaging_first_reply" ||
        type === "lead" ||
        type === "contact_total"
      ) {
        conversions += Number.parseInt(act.value as string, 10) || 0;
      }
    }
  }

  const costPerConversionCents = conversions > 0 ? Math.round(spendCents / conversions) : 0;

  return {
    campaign_id: (item.campaign_id as string) || "unknown",
    campaign_name: (item.campaign_name as string) || "Campanha Meta",
    adset_id: (item.adset_id as string) || null,
    adset_name: (item.adset_name as string) || null,
    ad_id: (item.ad_id as string) || null,
    ad_name: (item.ad_name as string) || null,
    date_reported: (item.date_start as string) || todayIso(),
    spend_cents: spendCents,
    impressions,
    clicks,
    ctr: Number(ctr.toFixed(2)),
    cpc_cents: cpcCents,
    conversions,
    cost_per_conversion_cents: costPerConversionCents,
    raw_data: item,
  };
}

/**
 * Retorna dados baseados nas campanhas reais da Trust Care em Cuiabá.
 */
function createMockMetaAdsClient(): MetaAdsClient {
  return {
    name: "meta-ads:trustcare-cuiaba",
    isLive: () => false,

    async getCampaigns(): Promise<MetaRealCampaign[]> {
      return [
        {
          id: "meta_camp_dobradica",
          name: "Dobradiça Notebook | WhatsApp | Out26",
          status: "active",
          objective: "OUTCOME_LEADS",
          daily_budget_cents: 2000,
          start_time: "2026-10-03",
        },
        {
          id: "meta_camp_upgrade_ssd",
          name: "TCT_Vendas_UpgradeSSD_CBO_Jul26",
          status: "paused",
          objective: "OUTCOME_LEADS",
          daily_budget_cents: 3000,
          start_time: "2026-07-15",
        },
        {
          id: "meta_camp_insta_growth",
          name: "Crescimento do Instagram - NL Julho de 2026",
          status: "paused",
          objective: "OUTCOME_TRAFFIC",
          daily_budget_cents: 700,
          start_time: "2026-07-20",
        },
        {
          id: "meta_camp_trust_care_main",
          name: "Trust Care",
          status: "paused",
          objective: "OUTCOME_LEADS",
          daily_budget_cents: 2000,
          start_time: "2026-06-01",
        },
      ];
    },

    async getAdSets(campaignId?: string): Promise<MetaRealAdSet[]> {
      const allAdSets: MetaRealAdSet[] = [
        {
          id: "meta_adset_dobradica_cuiaba",
          name: "Cuiabá e VG - Dobradiça Quebrada e Carcaça",
          status: "active",
          campaign_id: "meta_camp_dobradica",
          daily_budget_cents: 2000,
          optimization_goal: "CONVERSATIONS",
        },
        {
          id: "meta_adset_upgrade_cuiaba",
          name: "Público Aberto Cuiabá 22-55 - Upgrade SSD",
          status: "paused",
          campaign_id: "meta_camp_upgrade_ssd",
          daily_budget_cents: 3000,
          optimization_goal: "CONVERSATIONS",
        },
        {
          id: "meta_adset_insta_perfil",
          name: "Interesses Informática e Tecnologia - Cuiabá",
          status: "paused",
          campaign_id: "meta_camp_insta_growth",
          daily_budget_cents: 700,
          optimization_goal: "PROFILE_VISITS",
        },
        {
          id: "meta_adset_trust_care_geral",
          name: "Geral Cuiabá e Várzea Grande 15km",
          status: "paused",
          campaign_id: "meta_camp_trust_care_main",
          daily_budget_cents: 2000,
          optimization_goal: "CONVERSATIONS",
        },
      ];
      if (campaignId) {
        return allAdSets.filter((s) => s.campaign_id === campaignId);
      }
      return allAdSets;
    },

    async getAds(campaignId?: string, adsetId?: string): Promise<MetaRealAd[]> {
      const allAds: MetaRealAd[] = [
        {
          id: "meta_ad_dobradica_video",
          name: "Reel: Dobradiça Quebrada? Reparo sem trocar a carcaça",
          status: "active",
          campaign_id: "meta_camp_dobradica",
          adset_id: "meta_adset_dobradica_cuiaba",
          title: "Seu notebook está abrindo com estalo?",
          body: "Na Trust Care recuperamos a dobradiça do seu notebook no mesmo dia.",
        },
        {
          id: "meta_ad_upgrade_video",
          name: "Vídeo: Notebook Lento - Comparativo HD vs SSD",
          status: "paused",
          campaign_id: "meta_camp_upgrade_ssd",
          adset_id: "meta_adset_upgrade_cuiaba",
          title: "Não compre outro notebook!",
          body: "Multiplique a velocidade do seu notebook com upgrade rápido.",
        },
        {
          id: "meta_ad_insta_carrossel",
          name: "Carrossel: Dicas de Manutenção Preventiva",
          status: "paused",
          campaign_id: "meta_camp_insta_growth",
          adset_id: "meta_adset_insta_perfil",
          title: "Siga a Trust Care no Instagram",
          body: "Dicas semanais para seu computador durar o dobro.",
        },
        {
          id: "meta_ad_trust_care_institucional",
          name: "Vídeo Bancada: Assistência Técnica Especializada em Cuiabá",
          status: "paused",
          campaign_id: "meta_camp_trust_care_main",
          adset_id: "meta_adset_trust_care_geral",
          title: "A assistência de confiança em Cuiabá e VG",
          body: "Laboratório próprio, orçamento transparente e garantia.",
        },
      ];
      return allAds.filter((a) => {
        if (campaignId && a.campaign_id !== campaignId) return false;
        if (adsetId && a.adset_id !== adsetId) return false;
        return true;
      });
    },

    async getCampaignInsights(params = {}) {
      const today = todayIso();
      const days = [0, -1, -2, -3, -4, -5, -6];

      const mockEntries = [
        {
          campaign_id: "meta_camp_dobradica",
          campaign_name: "Dobradiça Notebook | WhatsApp | Out26",
          adset_id: "meta_adset_dobradica_cuiaba",
          adset_name: "Cuiabá e VG - Dobradiça Quebrada e Carcaça",
          ad_id: "meta_ad_dobradica_video",
          ad_name: "Reel: Dobradiça Quebrada? Reparo sem trocar a carcaça",
          baseSpend: 1540,
          baseImpressions: 545,
          clicksFactor: 0.029,
          conversionsFactor: 0.055,
        },
        {
          campaign_id: "meta_camp_trust_care_main",
          campaign_name: "Trust Care",
          adset_id: "meta_adset_trust_care_geral",
          adset_name: "Geral Cuiabá e Várzea Grande 15km",
          ad_id: "meta_ad_trust_care_institucional",
          ad_name: "Vídeo Bancada: Assistência Técnica Especializada em Cuiabá",
          baseSpend: 7690,
          baseImpressions: 2100,
          clicksFactor: 0.024,
          conversionsFactor: 0.048,
        },
      ];

      const results: MetaAdsCampaignInsight[] = [];

      for (const dayOffset of days) {
        const date = addDays(today, dayOffset);
        for (const entry of mockEntries) {
          if (params.campaignId && params.campaignId !== entry.campaign_id) continue;
          if (params.adsetId && params.adsetId !== entry.adset_id) continue;
          if (params.adId && params.adId !== entry.ad_id) continue;

          const jitter = 0.9 + ((date.charCodeAt(9) + entry.ad_id.charCodeAt(8)) % 20) / 100;
          const spendCents = Math.round(entry.baseSpend * jitter);
          const impressions = Math.round(entry.baseImpressions * jitter);
          const clicks = Math.max(1, Math.round(impressions * entry.clicksFactor * jitter));
          const ctr = Number(((clicks / impressions) * 100).toFixed(2));
          const cpcCents = Math.round(spendCents / clicks);
          const conversions = Math.max(0, Math.round(clicks * entry.conversionsFactor));
          const costPerConversionCents = conversions > 0 ? Math.round(spendCents / conversions) : 0;

          results.push({
            campaign_id: entry.campaign_id,
            campaign_name: entry.campaign_name,
            adset_id: entry.adset_id,
            adset_name: entry.adset_name,
            ad_id: params.level === "campaign" ? null : params.level === "adset" ? null : entry.ad_id,
            ad_name: params.level === "campaign" ? null : params.level === "adset" ? null : entry.ad_name,
            date_reported: date,
            spend_cents: spendCents,
            impressions,
            clicks,
            ctr,
            cpc_cents: cpcCents,
            conversions,
            cost_per_conversion_cents: costPerConversionCents,
            raw_data: {
              source: "trust_care_cuiaba_meta",
            },
          });
        }
      }

      return results;
    },

    async getAccountSummary() {
      const insights = await this.getCampaignInsights();
      const totalSpendCents = insights.reduce((acc, curr) => acc + curr.spend_cents, 0);
      const totalImpressions = insights.reduce((acc, curr) => acc + curr.impressions, 0);
      const totalClicks = insights.reduce((acc, curr) => acc + curr.clicks, 0);
      const totalConversions = insights.reduce((acc, curr) => acc + curr.conversions, 0);

      const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
      const avgCpcCents = totalClicks > 0 ? Math.round(totalSpendCents / totalClicks) : 0;
      const avgCplCents = totalConversions > 0 ? Math.round(totalSpendCents / totalConversions) : 0;

      return {
        total_spend_cents: totalSpendCents,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        avg_ctr: avgCtr,
        avg_cpc_cents: avgCpcCents,
        total_conversions: totalConversions,
        avg_cpl_cents: avgCplCents,
      };
    },
  };
}

/**
 * Cliente real para a Graph API da Meta (Marketing API).
 */
function createDirectMetaAdsClient(accessToken: string, rawAdAccountId: string): MetaAdsClient {
  const accountId = formatAdAccountId(rawAdAccountId);

  return {
    name: `meta-ads:${accountId}`,
    isLive: () => true,

    async getAdAccounts(): Promise<Array<{ id: string; name: string }>> {
      try {
        const url = new URL(`https://graph.facebook.com/v21.0/me/adaccounts`);
        url.searchParams.set("access_token", accessToken);
        url.searchParams.set("fields", "id,name,account_status,currency");
        url.searchParams.set("limit", "25");

        const res = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        const json = await res.json();
        const list = Array.isArray(json.data) ? json.data : [];
        return list.map((item: Record<string, unknown>) => ({
          id: item.id as string,
          name: (item.name as string) || "Conta Meta",
        }));
      } catch (err) {
        console.warn("Falha ao buscar adaccounts em /me/adaccounts:", err);
        return [];
      }
    },

    async getCampaigns(): Promise<MetaRealCampaign[]> {
      const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/campaigns`);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("fields", "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time");
      url.searchParams.set("limit", "50");

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || `Erro ao consultar campanhas da Meta (${response.status})`);
      }

      const list = Array.isArray(json.data) ? json.data : [];
      return list.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        name: (item.name as string) || "Campanha sem nome",
        status: ((item.status as string) || "ACTIVE").toLowerCase(),
        objective: item.objective as string,
        daily_budget_cents: item.daily_budget ? Math.round(Number(item.daily_budget)) : undefined,
        lifetime_budget_cents: item.lifetime_budget ? Math.round(Number(item.lifetime_budget)) : undefined,
        start_time: item.start_time as string,
        stop_time: item.stop_time as string,
      }));
    },

    async getAdSets(campaignId?: string): Promise<MetaRealAdSet[]> {
      const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/adsets`);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set(
        "fields",
        "id,name,status,campaign_id,daily_budget,lifetime_budget,billing_event,optimization_goal,targeting,start_time,end_time"
      );
      url.searchParams.set("limit", "100");

      if (campaignId) {
        url.searchParams.set("filtering", JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: campaignId }]));
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || `Erro ao consultar conjuntos de anúncios (${response.status})`);
      }

      const list = Array.isArray(json.data) ? json.data : [];
      return list.map((item: Record<string, unknown>) => ({
        id: item.id as string,
        name: (item.name as string) || "Conjunto de Anúncios",
        status: ((item.status as string) || "ACTIVE").toLowerCase(),
        campaign_id: item.campaign_id as string,
        daily_budget_cents: item.daily_budget ? Math.round(Number(item.daily_budget)) : undefined,
        lifetime_budget_cents: item.lifetime_budget ? Math.round(Number(item.lifetime_budget)) : undefined,
        billing_event: item.billing_event as string | undefined,
        optimization_goal: item.optimization_goal as string | undefined,
        targeting: item.targeting as Record<string, unknown> | undefined,
        start_time: item.start_time as string | undefined,
        end_time: item.end_time as string | undefined,
      }));
    },

    async getAds(campaignId?: string, adsetId?: string): Promise<MetaRealAd[]> {
      const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/ads`);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("fields", "id,name,status,campaign_id,adset_id,creative{title,body,image_url}");
      url.searchParams.set("limit", "100");

      const filters: Array<{ field: string; operator: string; value: string }> = [];
      if (campaignId) filters.push({ field: "campaign.id", operator: "EQUAL", value: campaignId });
      if (adsetId) filters.push({ field: "adset.id", operator: "EQUAL", value: adsetId });
      if (filters.length > 0) {
        url.searchParams.set("filtering", JSON.stringify(filters));
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || `Erro ao consultar anúncios da Meta (${response.status})`);
      }

      const list = Array.isArray(json.data) ? json.data : [];
      return list.map((item: Record<string, unknown>) => {
        const creative = item.creative as Record<string, unknown> | undefined;
        return {
          id: item.id as string,
          name: (item.name as string) || "Anúncio",
          status: ((item.status as string) || "ACTIVE").toLowerCase(),
          campaign_id: item.campaign_id as string,
          adset_id: item.adset_id as string | undefined,
          title: creative?.title as string | undefined,
          body: creative?.body as string | undefined,
          image_url: creative?.image_url as string | undefined,
        };
      });
    },

    async getCampaignInsights(params = {}) {
      const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/insights`);
      url.searchParams.set("access_token", accessToken);

      const level = params.level || "campaign";
      url.searchParams.set("level", level);

      if (level === "ad") {
        url.searchParams.set(
          "fields",
          "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type"
        );
      } else if (level === "adset") {
        url.searchParams.set(
          "fields",
          "campaign_id,campaign_name,adset_id,adset_name,date_start,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type"
        );
      } else {
        url.searchParams.set(
          "fields",
          "campaign_id,campaign_name,date_start,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type"
        );
      }
      url.searchParams.set("time_increment", "1");

      if (params.since && params.until) {
        url.searchParams.set("time_range", JSON.stringify({ since: params.since, until: params.until }));
      } else if (params.datePreset) {
        url.searchParams.set("date_preset", params.datePreset);
      } else {
        url.searchParams.set("date_preset", "last_30d");
      }

      const filters: Array<{ field: string; operator: string; value: string }> = [];
      if (params.campaignId) filters.push({ field: "campaign.id", operator: "EQUAL", value: params.campaignId });
      if (params.adsetId) filters.push({ field: "adset.id", operator: "EQUAL", value: params.adsetId });
      if (params.adId) filters.push({ field: "ad.id", operator: "EQUAL", value: params.adId });
      if (filters.length > 0) {
        url.searchParams.set("filtering", JSON.stringify(filters));
      }

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error?.message || `Erro da Meta (${response.status}) ao buscar métricas.`);
      }

      const data = Array.isArray(json.data) ? json.data : [];

      // Se nos últimos 30 dias não houver dados, tenta buscar o histórico total (maximum)
      if (data.length === 0 && !params.since && !params.datePreset) {
        const maxUrl = new URL(url.toString());
        maxUrl.searchParams.set("date_preset", "maximum");
        const maxRes = await fetch(maxUrl.toString(), { headers: { Accept: "application/json" }, cache: "no-store" });
        const maxJson = await maxRes.json();
        if (maxRes.ok && Array.isArray(maxJson.data) && maxJson.data.length > 0) {
          return maxJson.data.map(mapRawInsight);
        }
      }

      return data.map(mapRawInsight);
    },

    async getAccountSummary() {
      const insights = await this.getCampaignInsights();
      const totalSpendCents = insights.reduce((acc, curr) => acc + curr.spend_cents, 0);
      const totalImpressions = insights.reduce((acc, curr) => acc + curr.impressions, 0);
      const totalClicks = insights.reduce((acc, curr) => acc + curr.clicks, 0);
      const totalConversions = insights.reduce((acc, curr) => acc + curr.conversions, 0);

      const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
      const avgCpcCents = totalClicks > 0 ? Math.round(totalSpendCents / totalClicks) : 0;
      const avgCplCents = totalConversions > 0 ? Math.round(totalSpendCents / totalConversions) : 0;

      return {
        total_spend_cents: totalSpendCents,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        avg_ctr: avgCtr,
        avg_cpc_cents: avgCpcCents,
        total_conversions: totalConversions,
        avg_cpl_cents: avgCplCents,
      };
    },
  };
}

export function isMetaAdsConfigured(customConfig?: { access_token?: string; ad_account_id?: string }): boolean {
  const token = customConfig?.access_token || process.env.META_ACCESS_TOKEN;
  const accountId = customConfig?.ad_account_id || process.env.META_AD_ACCOUNT_ID;
  return Boolean(token && accountId);
}

export function getMetaAdsClient(customConfig?: { access_token?: string; ad_account_id?: string }): MetaAdsClient {
  const token = customConfig?.access_token || process.env.META_ACCESS_TOKEN;
  const accountId = customConfig?.ad_account_id || process.env.META_AD_ACCOUNT_ID;

  if (token && accountId) {
    return createDirectMetaAdsClient(token, accountId);
  }

  return createMockMetaAdsClient();
}
