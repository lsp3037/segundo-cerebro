"use client";

import { useMemo, useState } from "react";
import {
  DollarSignIcon,
  MousePointerClickIcon,
  PercentIcon,
  MessageCircleIcon,
  EyeIcon,
  TargetIcon,
} from "lucide-react";

import { formatCentsToBrl, formatPercent } from "../meta";
import { McpSyncCard } from "./mcp-sync-card";
import { AdsManagerView } from "./ads-manager-view";
import { AiCampaignDiagnostics } from "./ai-campaign-diagnostics";
import {
  computeRangeForPreset,
  type MetaDateRangeValue,
} from "./meta-date-picker";
import type { Tables } from "@/lib/supabase/database.types";
import type { MetaRealAdSet } from "@/lib/integrations/meta-ads/types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;
type Metric = Tables<"meta_ads_metrics">;

interface AdsAnalyzerDashboardProps {
  campaigns: Campaign[];
  angles: Angle[];
  metrics: Metric[];
  adsets?: MetaRealAdSet[];
  onRefreshMetrics?: () => void;
}

export function AdsAnalyzerDashboard({
  campaigns,
  angles,
  metrics,
  adsets = [],
  onRefreshMetrics,
}: AdsAnalyzerDashboardProps) {
  // Filtro de período no padrão Meta Ads Manager
  const [dateRange, setDateRange] = useState<MetaDateRangeValue>(() => {
    const computed = computeRangeForPreset("last_30d");
    return {
      preset: "last_30d",
      startDate: computed.startDate,
      endDate: computed.endDate,
      label: computed.label,
    };
  });

  // Filtra métricas pelo período selecionado
  const filteredMetrics = useMemo(() => {
    if (!metrics || metrics.length === 0) return [];
    return metrics.filter((m) => {
      if (!m.date_reported) return true;
      return m.date_reported >= dateRange.startDate && m.date_reported <= dateRange.endDate;
    });
  }, [metrics, dateRange]);

  // Constrói totais agregados para o período
  const summary = useMemo(() => {
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;

    if (filteredMetrics.length > 0) {
      for (const m of filteredMetrics) {
        totalSpend += m.spend_cents;
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalLeads += m.conversions;
      }
    } else {
      // Se não há métricas consolidadas na tabela filtrada, verifica se há métricas brutas ou soma os caches dos ângulos reais
      for (const a of angles) {
        const cached = (a.metrics_cached as Record<string, number | undefined> | null) || {};
        if (cached.spend_cents) totalSpend += cached.spend_cents;
        if (cached.impressions) totalImpressions += cached.impressions;
        if (cached.clicks) totalClicks += cached.clicks;
        if (cached.leads || cached.conversions) totalLeads += (cached.leads ?? cached.conversions ?? 0);
      }
    }

    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? Math.round(totalSpend / totalClicks) : 0;
    const avgCpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;

    return {
      totalSpend,
      totalImpressions,
      totalClicks,
      totalLeads,
      avgCtr,
      avgCpc,
      avgCpl,
    };
  }, [filteredMetrics, angles]);

  const topAngle = useMemo(() => {
    const winner = angles.find((a) => a.status === "winner");
    if (winner) return winner.title;
    if (angles.length > 0) return angles[0].title;
    return undefined;
  }, [angles]);

  return (
    <div className="space-y-6">
      {/* Gatilho MCP Sync com suporte ao período */}
      <McpSyncCard onSyncComplete={onRefreshMetrics} dateRange={dateRange} />

      {/* Grid de KPIs de Destaque */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Investimento */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <DollarSignIcon className="size-3.5 text-emerald-500" />
            Gasto Total
          </span>
          <p className="text-lg font-bold text-foreground">
            {formatCentsToBrl(summary.totalSpend)}
          </p>
          <span className="text-[10px] text-muted-foreground block truncate">{dateRange.label}</span>
        </div>

        {/* Impressões */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <EyeIcon className="size-3.5 text-blue-500" />
            Impressões
          </span>
          <p className="text-lg font-bold text-foreground">
            {summary.totalImpressions.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-muted-foreground block">Feed & Stories Cuiabá</span>
        </div>

        {/* Cliques */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <MousePointerClickIcon className="size-3.5 text-indigo-500" />
            Cliques no Link
          </span>
          <p className="text-lg font-bold text-foreground">
            {summary.totalClicks.toLocaleString("pt-BR")}
          </p>
          <span className="text-[10px] text-muted-foreground block">CPC: {formatCentsToBrl(summary.avgCpc)}</span>
        </div>

        {/* CTR Médio */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <PercentIcon className="size-3.5 text-purple-500" />
            CTR Médio
          </span>
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {formatPercent(summary.avgCtr)}
          </p>
          <span
            className={`text-[10px] font-medium block ${
              summary.avgCtr > 1.5
                ? "text-emerald-600 dark:text-emerald-400"
                : summary.avgCtr > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            }`}
          >
            {summary.avgCtr > 1.5
              ? "Acima da média (1.5%)"
              : summary.avgCtr > 0
              ? "Abaixo da média"
              : "Sem veiculação"}
          </span>
        </div>

        {/* Conversões WhatsApp */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1 shadow-2xs border-emerald-500/30 bg-emerald-500/5">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <MessageCircleIcon className="size-3.5 text-emerald-500" />
            Leads WhatsApp
          </span>
          <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
            {summary.totalLeads}
          </p>
          <span className="text-[10px] text-muted-foreground block">Conversas iniciadas</span>
        </div>

        {/* Custo por Lead (CPL) */}
        <div className="rounded-xl border bg-card p-3.5 space-y-1 shadow-2xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <TargetIcon className="size-3.5 text-orange-500" />
            Custo por Lead
          </span>
          <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {formatCentsToBrl(summary.avgCpl)}
          </p>
          <span className="text-[10px] text-muted-foreground block">Por mensagem Zap</span>
        </div>
      </div>

      {/* Visualização em Níveis (Campanhas, Conjuntos, Anúncios) no padrão Meta Ads Manager com filtro de período */}
      <AdsManagerView
        campaigns={campaigns}
        angles={angles}
        metrics={filteredMetrics.length > 0 ? filteredMetrics : metrics}
        adsets={adsets}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      {/* Parecer Consultivo de IA (Geral Executiva e Pedro Sobral) */}
      <AiCampaignDiagnostics
        totalSpendCents={summary.totalSpend}
        totalClicks={summary.totalClicks}
        totalLeads={summary.totalLeads}
        avgCtr={summary.avgCtr}
        topAngleTitle={topAngle}
        periodLabel={dateRange.label}
      />
    </div>
  );
}
