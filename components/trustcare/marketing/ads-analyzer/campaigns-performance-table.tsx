"use client";

import { useMemo, useState } from "react";
import {
  MegaphoneIcon,
  MessageCircleIcon,
  MousePointerClickIcon,
  TargetIcon,
  LayersIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  CAMPAIGN_OBJECTIVES,
  formatCentsToBrl,
  formatPercent,
  labelOf,
} from "../meta";
import type { Tables } from "@/lib/supabase/database.types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;
type Metric = Tables<"meta_ads_metrics">;

interface CampaignsPerformanceTableProps {
  campaigns: Campaign[];
  angles: Angle[];
  metrics: Metric[];
}

export function CampaignsPerformanceTable({
  campaigns,
  angles,
  metrics,
}: CampaignsPerformanceTableProps) {
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");

  const campaignRows = useMemo(() => {
    return campaigns.map((campaign) => {
      const campMetrics = metrics.filter(
        (m) =>
          m.campaign_id === campaign.id ||
          (campaign.meta_campaign_id && m.meta_campaign_id === campaign.meta_campaign_id)
      );

      const campaignLevel = campMetrics.filter((m) => !m.meta_ad_id);
      const adLevel = campMetrics.filter((m) => Boolean(m.meta_ad_id));

      let spend = 0;
      let impressions = 0;
      let clicks = 0;
      let leads = 0;

      if (campaignLevel.length > 0) {
        for (const m of campaignLevel) {
          spend += m.spend_cents;
          impressions += m.impressions;
          clicks += m.clicks;
          leads += m.conversions;
        }
      } else if (adLevel.length > 0) {
        for (const m of adLevel) {
          spend += m.spend_cents;
          impressions += m.impressions;
          clicks += m.clicks;
          leads += m.conversions;
        }
      } else {
        const campAngles = angles.filter((a) => a.campaign_id === campaign.id);
        for (const a of campAngles) {
          const cached = (a.metrics_cached as Record<string, number | undefined> | null) || {};
          spend += cached.spend_cents ?? 0;
          impressions += cached.impressions ?? 0;
          clicks += cached.clicks ?? 0;
          leads += cached.leads ?? cached.conversions ?? 0;
        }
      }

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? Math.round(spend / clicks) : 0;
      const cpl = leads > 0 ? Math.round(spend / leads) : 0;
      const anglesCount = angles.filter((a) => a.campaign_id === campaign.id).length;

      return {
        campaign,
        spend,
        impressions,
        clicks,
        ctr,
        cpc,
        leads,
        cpl,
        anglesCount,
      };
    });
  }, [campaigns, metrics, angles]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return campaignRows;
    return campaignRows.filter((r) => r.campaign.status === filter);
  }, [campaignRows, filter]);

  const activeCount = useMemo(() => {
    return campaigns.filter((c) => c.status === "active").length;
  }, [campaigns]);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center space-y-3 shadow-2xs">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 mx-auto">
          <MegaphoneIcon className="size-6" />
        </div>
        <div className="space-y-1">
          <h4 className="font-semibold text-sm">Nenhuma campanha importada no momento</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Clique no botão <strong>Sincronizar Meta Ads</strong> acima para importar automaticamente as campanhas e métricas da sua conta da Meta (act_1671912470896313).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-2xs space-y-4 p-5">
      {/* Cabeçalho da Seção com Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-base leading-tight">Campanhas no Meta Ads</h4>
            <Badge variant="outline" className="text-xs font-mono">
              {activeCount} ativas de {campaigns.length}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Métricas de tráfego, orçamentos e custo por mensagem no WhatsApp para Cuiabá e Várzea Grande.
          </p>
        </div>

        {/* Filtro de Status */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              filter === "all" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas ({campaigns.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
              filter === "active" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Ativas ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("paused")}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              filter === "paused" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pausadas ({campaigns.length - activeCount})
          </button>
        </div>
      </div>

      {/* Tabela de Campanhas & KPIs */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3">Campanha</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Orçamento / Dia</th>
              <th className="py-2.5 px-3 text-right">Gasto (30d)</th>
              <th className="py-2.5 px-3 text-right">Impressões</th>
              <th className="py-2.5 px-3 text-right">Cliques</th>
              <th className="py-2.5 px-3 text-right">CTR Médio</th>
              <th className="py-2.5 px-3 text-right">CPC Médio</th>
              <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                Leads Zap
              </th>
              <th className="py-2.5 px-3 text-right">Custo / Lead (CPL)</th>
              <th className="py-2.5 px-3 text-center">Ângulos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredRows.map(({ campaign, spend, impressions, clicks, ctr, cpc, leads, cpl, anglesCount }) => {
              const isActive = campaign.status === "active";
              const objectiveLabel = labelOf(CAMPAIGN_OBJECTIVES, campaign.objective) || campaign.objective;

              return (
                <tr
                  key={campaign.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    isActive ? "bg-emerald-500/[0.02]" : ""
                  }`}
                >
                  {/* Nome da Campanha & Detalhes */}
                  <td className="py-3 px-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground line-clamp-1 text-sm">
                          {campaign.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TargetIcon className="size-3 text-orange-500" />
                          {objectiveLabel}
                        </span>
                        {campaign.meta_campaign_id && (
                          <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                            {campaign.meta_campaign_id}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-3 whitespace-nowrap">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                        Pausada
                      </span>
                    )}
                  </td>

                  {/* Orçamento Diário */}
                  <td className="py-3 px-3 text-right font-medium text-foreground whitespace-nowrap">
                    {campaign.budget_daily_cents > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCentsToBrl(campaign.budget_daily_cents)}
                        <span className="text-[10px] text-muted-foreground font-normal">/dia</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Sob demanda</span>
                    )}
                  </td>

                  {/* Gasto Total */}
                  <td className="py-3 px-3 text-right font-semibold text-foreground whitespace-nowrap">
                    {formatCentsToBrl(spend)}
                  </td>

                  {/* Impressões */}
                  <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                    {impressions.toLocaleString("pt-BR")}
                  </td>

                  {/* Cliques */}
                  <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">
                      <MousePointerClickIcon className="size-3 text-indigo-500" />
                      {clicks.toLocaleString("pt-BR")}
                    </span>
                  </td>

                  {/* CTR Médio */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        ctr > 1.5
                          ? "text-emerald-600 dark:text-emerald-400"
                          : ctr > 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatPercent(ctr)}
                    </span>
                  </td>

                  {/* CPC Médio */}
                  <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                    {formatCentsToBrl(cpc)}
                  </td>

                  {/* Leads WhatsApp */}
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <MessageCircleIcon className="size-3 text-emerald-500" />
                      {leads}
                    </span>
                  </td>

                  {/* Custo por Lead (CPL) */}
                  <td className="py-3 px-3 text-right font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                    {formatCentsToBrl(cpl)}
                  </td>

                  {/* Quantidade de Ângulos */}
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                      <LayersIcon className="size-3" />
                      {anglesCount}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
