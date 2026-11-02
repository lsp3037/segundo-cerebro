import "server-only";

import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type MarketingCampaign = Tables<"marketing_campaigns">;
export type CampaignAngle = Tables<"campaign_angles">;
export type MetaAdsMetric = Tables<"meta_ads_metrics">;
export type ContentIdea = Tables<"content_ideas">;

// Tipos estruturados de Roteiros (script_data)
export interface ReelScript {
  type: "reel";
  hook_3s: string;
  retention_body: string[];
  cta: string;
  audio_suggestion?: string;
  duration_seconds?: number;
}

export interface StoryFrame {
  number: number;
  goal: string;
  text: string;
  interactive_element?: string;
}

export interface StoryScript {
  type: "story";
  frames: StoryFrame[];
}

export interface CarouselSlide {
  index: number;
  role: "capa" | "conteudo" | "cta";
  headline: string;
  visual_cue?: string;
  body_text?: string;
}

export interface CarouselScript {
  type: "carousel";
  slides: CarouselSlide[];
}

export type ScriptData = ReelScript | StoryScript | CarouselScript | { type?: string; [key: string]: unknown };

export interface AngleMetricsCached {
  spend_cents?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpc_cents?: number;
  leads?: number;
  conversions?: number;
  cpl_cents?: number;
}

export type MarketingCampaignWithStats = MarketingCampaign & {
  angles_count: number;
  active_angles_count: number;
  winner_angles_count: number;
};

export interface CampaignsFilter {
  folderId?: string;
  folderIds?: string[];
  status?: string;
  includeArchived?: boolean;
}

/**
 * Retorna as campanhas de marketing com contagem de ângulos ativos.
 */
export async function getCampaigns(filter: CampaignsFilter = {}): Promise<MarketingCampaignWithStats[]> {
  const supabase = await createClient();

  let query = supabase
    .from("marketing_campaigns")
    .select("*, campaign_angles(id, status, deleted_at)")
    .is("deleted_at", null)
    .order("start_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter.folderId) {
    query = query.eq("folder_id", filter.folderId);
  } else if (filter.folderIds && filter.folderIds.length > 0) {
    query = query.in("folder_id", filter.folderIds);
  }

  if (filter.status) {
    query = query.eq("status", filter.status);
  } else if (!filter.includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching campaigns:", error);
    return [];
  }

  return (data ?? []).map((c) => {
    const rawAngles = Array.isArray(c.campaign_angles) ? c.campaign_angles : [];
    const nonDeleted = rawAngles.filter((a) => !a.deleted_at);
    const activeAngles = nonDeleted.filter((a) => a.status === "testing" || a.status === "winner");
    const winnerAngles = nonDeleted.filter((a) => a.status === "winner");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { campaign_angles, ...campaign } = c;

    return {
      ...campaign,
      angles_count: nonDeleted.length,
      active_angles_count: activeAngles.length,
      winner_angles_count: winnerAngles.length,
    };
  });
}

/**
 * Alias compatível com a assinatura inicial do banco.
 */
export async function getMarketingCampaigns(filter: { folderIds?: string[] } = {}): Promise<MarketingCampaignWithStats[]> {
  return getCampaigns({ folderIds: filter.folderIds, includeArchived: true });
}

/**
 * Retorna uma campanha específica pelo ID com contagem de ângulos.
 */
export async function getCampaignById(campaignId: string): Promise<MarketingCampaignWithStats | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*, campaign_angles(id, status, deleted_at)")
    .eq("id", campaignId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("Error fetching campaign by id:", error);
    return null;
  }
  if (!data) return null;

  const rawAngles = Array.isArray(data.campaign_angles) ? data.campaign_angles : [];
  const nonDeleted = rawAngles.filter((a) => !a.deleted_at);
  const activeAngles = nonDeleted.filter((a) => a.status === "testing" || a.status === "winner");
  const winnerAngles = nonDeleted.filter((a) => a.status === "winner");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { campaign_angles, ...campaign } = data;

  return {
    ...campaign,
    angles_count: nonDeleted.length,
    active_angles_count: activeAngles.length,
    winner_angles_count: winnerAngles.length,
  };
}

/**
 * Retorna os ângulos de anúncios de uma campanha ou de todas.
 */
export async function getCampaignAngles(campaignId?: string): Promise<CampaignAngle[]> {
  const supabase = await createClient();

  let query = supabase
    .from("campaign_angles")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (campaignId) {
    query = query.eq("campaign_id", campaignId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching campaign angles:", error);
    return [];
  }
  return data ?? [];
}

export interface MetricsFilter {
  campaignId?: string;
  metaCampaignId?: string;
  metaAdId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Retorna as métricas do Meta Ads gravadas no banco.
 */
export async function getMetaAdsMetrics(filterOrCampaignId?: string | MetricsFilter): Promise<MetaAdsMetric[]> {
  const supabase = await createClient();

  const filter: MetricsFilter =
    typeof filterOrCampaignId === "string" ? { campaignId: filterOrCampaignId } : filterOrCampaignId ?? {};

  let query = supabase
    .from("meta_ads_metrics")
    .select("*")
    .order("date_reported", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter.campaignId) query = query.eq("campaign_id", filter.campaignId);
  if (filter.metaCampaignId) query = query.eq("meta_campaign_id", filter.metaCampaignId);
  if (filter.metaAdId) query = query.eq("meta_ad_id", filter.metaAdId);
  if (filter.startDate) query = query.gte("date_reported", filter.startDate);
  if (filter.endDate) query = query.lte("date_reported", filter.endDate);
  query = query.limit(filter.limit ?? 100);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching meta ads metrics:", error);
    return [];
  }
  return data ?? [];
}

export interface ContentIdeasFilter {
  folderId?: string;
  folderIds?: string[];
  format?: string;
  angleId?: string;
  status?: string;
}

/**
 * Retorna ideias de conteúdo que contenham dados de roteiro (script_data) ou vinculadas a um ângulo.
 */
export async function getContentIdeasWithScripts(filter: ContentIdeasFilter = {}): Promise<ContentIdea[]> {
  const supabase = await createClient();

  let query = supabase
    .from("content_ideas")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (filter.folderId) {
    query = query.eq("folder_id", filter.folderId);
  } else if (filter.folderIds && filter.folderIds.length > 0) {
    query = query.in("folder_id", filter.folderIds);
  }

  if (filter.format) query = query.eq("format", filter.format);
  if (filter.angleId) query = query.eq("campaign_angle_id", filter.angleId);
  if (filter.status) query = query.eq("status", filter.status);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching content ideas with scripts:", error);
    return [];
  }
  return data ?? [];
}

/**
 * Retorna conteúdos de roteiros em Reels, Carrosséis e Stories.
 */
export async function getMarketingContentScripts(filter: { folderIds?: string[] } = {}): Promise<ContentIdea[]> {
  return getContentIdeasWithScripts({ folderIds: filter.folderIds });
}

export interface MarketingDashboardSummary {
  activeCampaignsCount: number;
  totalDailyBudgetCents: number;
  totalAnglesCount: number;
  winnerAnglesCount: number;
  totalSpendLast30dCents: number;
  totalClicksLast30d: number;
  totalConversionsLast30d: number;
  avgCtr: number;
  avgCpcCents: number;
  avgCplCents: number;
}

/**
 * Retorna o resumo consolidado para alimentar o cabeçalho executivo do Hub de Marketing.
 */
export async function getMarketingDashboardSummary(folderId?: string): Promise<MarketingDashboardSummary> {
  const [campaigns, angles, metrics] = await Promise.all([
    getCampaigns({ folderId }),
    getCampaignAngles(),
    getMetaAdsMetrics({ limit: 100 }),
  ]);

  const activeCampaigns = campaigns.filter((c) => c.status === "active" || c.status === "scheduled");
  const totalDailyBudgetCents = activeCampaigns.reduce((acc, c) => acc + c.budget_daily_cents, 0);

  const winnerAngles = angles.filter((a) => a.status === "winner");

  // Consolidação de métricas recentes
  const totalSpend = metrics.reduce((acc, m) => acc + m.spend_cents, 0);
  const totalImpressions = metrics.reduce((acc, m) => acc + m.impressions, 0);
  const totalClicks = metrics.reduce((acc, m) => acc + m.clicks, 0);
  const totalConversions = metrics.reduce((acc, m) => acc + m.conversions, 0);

  const avgCtr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const avgCpcCents = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;
  const avgCplCents = totalConversions > 0 ? Math.round(totalSpend / totalConversions) : 0;

  return {
    activeCampaignsCount: activeCampaigns.length,
    totalDailyBudgetCents,
    totalAnglesCount: angles.length,
    winnerAnglesCount: winnerAngles.length,
    totalSpendLast30dCents: totalSpend,
    totalClicksLast30d: totalClicks,
    totalConversionsLast30d: totalConversions,
    avgCtr,
    avgCpcCents,
    avgCplCents,
  };
}
