import "server-only";

import { addDays, todayIso } from "@/lib/dates";
import type { MetaAdsCampaignInsight, MetaAdsClient, MetaRealAd, MetaRealCampaign } from "./types";

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
        type === "lead" ||
        type === "contact_total" ||
        type === "onsite_conversion.messaging_first_reply"
      ) {
        conversions += Number.parseInt(act.value as string, 10) || 0;
      }
    }
  }

  const costPerConversionCents = conversions > 0 ? Math.round(spendCents / conversions) : 0;

  return {
    campaign_id: (item.campaign_id as string) || "unknown",
    campaign_name: (item.campaign_name as string) || "Campanha Meta",
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
 * Retorna dados simulados realistas para a Trust Care em Cuiabá e Várzea Grande.
 * Usado como fallback quando as credenciais do Meta Ads não foram configuradas.
 */
function createMockMetaAdsClient(): MetaAdsClient {
  return {
    name: "meta-ads:mock-cuiaba",
    isLive: () => false,

    async getCampaigns(): Promise<MetaRealCampaign[]> {
      return [
        {
          id: "meta_camp_tc_upgrade",
          name: "Campanha Upgrade Turbo 2026",
          status: "active",
          objective: "OUTCOME_LEADS",
          daily_budget_cents: 3500,
          start_time: todayIso(),
        },
        {
          id: "meta_camp_tc_seminovos",
          name: "Campanha Notebooks Seminovos Cuiabá",
          status: "paused",
          objective: "OUTCOME_LEADS",
          daily_budget_cents: 4500,
          start_time: todayIso(),
        },
      ];
    },

    async getAds(): Promise<MetaRealAd[]> {
      return [
        {
          id: "meta_ad_dor_pc_lento",
          name: "Vídeo Reel: PC Travando no Home Office",
          status: "active",
          campaign_id: "meta_camp_tc_upgrade",
          title: "Seu notebook trava toda hora?",
          body: "Na Trust Care em Cuiabá recuperamos seu equipamento com upgrade rápido.",
        },
        {
          id: "meta_ad_custo_beneficio",
          name: "Carrossel: Economize 70% Não Comprando PC Novo",
          status: "active",
          campaign_id: "meta_camp_tc_upgrade",
          title: "Não compre outro PC de 4 mil!",
          body: "Trocar o HD por SSD deixa seu notebook até 10x mais veloz.",
        },
      ];
    },

    async getCampaignInsights(params = {}) {
      const today = todayIso();
      const days = [0, -1, -2, -3, -4, -5, -6];

      const mockAds = [
        {
          campaign_id: "meta_camp_tc_upgrade",
          campaign_name: "Campanha Upgrade Turbo 2026",
          ad_id: "meta_ad_dor_pc_lento",
          ad_name: "Vídeo Reel: PC Travando no Home Office",
          baseSpend: 4200,
          baseImpressions: 2400,
          clicksFactor: 0.032,
          conversionsFactor: 0.12,
        },
        {
          campaign_id: "meta_camp_tc_upgrade",
          campaign_name: "Campanha Upgrade Turbo 2026",
          ad_id: "meta_ad_custo_beneficio",
          ad_name: "Carrossel: Economize 70% Não Comprando PC Novo",
          baseSpend: 3500,
          baseImpressions: 1950,
          clicksFactor: 0.026,
          conversionsFactor: 0.09,
        },
      ];

      const results: MetaAdsCampaignInsight[] = [];

      for (const dayOffset of days) {
        const date = addDays(today, dayOffset);
        for (const ad of mockAds) {
          if (params.campaignId && params.campaignId !== ad.campaign_id) continue;

          const jitter = 0.85 + ((date.charCodeAt(9) + ad.ad_id.charCodeAt(8)) % 30) / 100;
          const spendCents = Math.round(ad.baseSpend * jitter);
          const impressions = Math.round(ad.baseImpressions * jitter);
          const clicks = Math.max(1, Math.round(impressions * ad.clicksFactor * jitter));
          const ctr = Number(((clicks / impressions) * 100).toFixed(2));
          const cpcCents = Math.round(spendCents / clicks);
          const conversions = Math.max(1, Math.round(clicks * ad.conversionsFactor));
          const costPerConversionCents = Math.round(spendCents / conversions);

          results.push({
            campaign_id: ad.campaign_id,
            campaign_name: ad.campaign_name,
            ad_id: ad.ad_id,
            ad_name: ad.ad_name,
            date_reported: date,
            spend_cents: spendCents,
            impressions,
            clicks,
            ctr,
            cpc_cents: cpcCents,
            conversions,
            cost_per_conversion_cents: costPerConversionCents,
            raw_data: {
              source: "simulated_local_cuiaba",
              location: "Cuiabá e Várzea Grande (MT)",
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

    async getAds(campaignId?: string): Promise<MetaRealAd[]> {
      const url = new URL(`https://graph.facebook.com/v21.0/${accountId}/ads`);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("fields", "id,name,status,campaign_id,creative{title,body,image_url}");
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
          "campaign_id,campaign_name,ad_id,ad_name,date_start,spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type"
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

      if (params.campaignId) {
        url.searchParams.set("filtering", JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: params.campaignId }]));
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
