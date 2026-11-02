export interface MetaAdsCampaignInsight {
  campaign_id: string;
  campaign_name: string;
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

export interface MetaRealAd {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  title?: string;
  body?: string;
  image_url?: string;
}

export interface MetaAdsClient {
  readonly name: string;
  isLive(): boolean;
  getCampaigns(): Promise<MetaRealCampaign[]>;
  getAds(campaignId?: string): Promise<MetaRealAd[]>;
  getCampaignInsights(params?: {
    campaignId?: string;
    since?: string;
    until?: string;
    datePreset?: string;
  }): Promise<MetaAdsCampaignInsight[]>;
  getAccountSummary(): Promise<MetaAdsAccountSummary>;
}
