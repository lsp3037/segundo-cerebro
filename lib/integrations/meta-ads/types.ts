export interface MetaAdsCampaignInsight {
  campaign_id: string;
  campaign_name: string;
  adset_id?: string | null;
  adset_name?: string | null;
  ad_id?: string | null;
  ad_name?: string | null;
  date_reported: string; // ISO date 'YYYY-MM-DD'
  spend_cents: number;
  impressions: number;
  clicks: number;
  ctr: number; // Porcentagem, ex: 2.85
  cpc_cents: number;
  conversions: number; // Leads / Mensagens WhatsApp iniciadas
  cost_per_conversion_cents: number; // CPL em centavos
  raw_data?: Record<string, unknown>;
}

export interface MetaAdsAccountSummary {
  total_spend_cents: number;
  total_impressions: number;
  total_clicks: number;
  avg_ctr: number;
  avg_cpc_cents: number;
  total_conversions: number;
  avg_cpl_cents: number;
}

export interface MetaRealCampaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  daily_budget_cents?: number;
  lifetime_budget_cents?: number;
  start_time?: string;
  stop_time?: string;
}

export interface MetaRealAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  daily_budget_cents?: number;
  lifetime_budget_cents?: number;
  billing_event?: string;
  optimization_goal?: string;
  targeting?: Record<string, unknown>;
  start_time?: string;
  end_time?: string;
}

export interface MetaRealAd {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  adset_id?: string;
  title?: string;
  body?: string;
  image_url?: string;
}

export interface MetaAdsClient {
  readonly name: string;
  isLive(): boolean;
  getAdAccounts?(): Promise<Array<{ id: string; name: string }>>;
  getCampaigns(): Promise<MetaRealCampaign[]>;
  getAdSets(campaignId?: string): Promise<MetaRealAdSet[]>;
  getAds(campaignId?: string, adsetId?: string): Promise<MetaRealAd[]>;
  getCampaignInsights(params?: {
    campaignId?: string;
    adsetId?: string;
    adId?: string;
    since?: string;
    until?: string;
    datePreset?: string;
    level?: "campaign" | "adset" | "ad";
  }): Promise<MetaAdsCampaignInsight[]>;
  getAccountSummary(): Promise<MetaAdsAccountSummary>;
}
