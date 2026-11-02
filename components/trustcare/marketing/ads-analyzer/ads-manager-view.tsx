"use client";

import { useMemo, useState, useCallback } from "react";
import {
  FolderIcon,
  LayoutGridIcon,
  FileTextIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  formatCentsToBrl,
  formatPercent,
} from "../meta";
import { MetaDatePicker, type MetaDateRangeValue } from "./meta-date-picker";
import type { Tables } from "@/lib/supabase/database.types";
import type { MetaRealAdSet } from "@/lib/integrations/meta-ads/types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;
type Metric = Tables<"meta_ads_metrics">;

interface AdsManagerViewProps {
  campaigns: Campaign[];
  angles: Angle[];
  metrics: Metric[];
  adsets?: MetaRealAdSet[];
  dateRange?: MetaDateRangeValue;
  onDateRangeChange?: (value: MetaDateRangeValue) => void;
}

export function AdsManagerView({
  campaigns,
  angles,
  metrics,
  adsets = [],
  dateRange,
  onDateRangeChange,
}: AdsManagerViewProps) {
  // Nível ativo: 'campaigns' | 'adsets' | 'ads'
  const [currentLevel, setCurrentLevel] = useState<"campaigns" | "adsets" | "ads">("campaigns");

  // Filtro de seleção (drill-down como na Meta)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string | null>(null);

  // Filtros de busca e veiculação
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused">("all");

  // Nome da campanha selecionada
  const selectedCampaign = useMemo(() => {
    if (!selectedCampaignId) return null;
    return campaigns.find(
      (c) => c.id === selectedCampaignId || c.meta_campaign_id === selectedCampaignId
    );
  }, [campaigns, selectedCampaignId]);

  // Lista de AdSets consolidada (da prop ou gerada a partir dos ângulos/métricas)
  const effectiveAdSets = useMemo(() => {
    if (adsets.length > 0) return adsets;

    // Se adsets não veio diretamente, infere a partir dos ângulos e métricas
    const setMap = new Map<string, MetaRealAdSet>();

    for (const a of angles) {
      const cached = (a.metrics_cached as Record<string, unknown> | null) || {};
      const adsetId = (cached.adset_id as string) || `adset_${a.campaign_id}`;
      const adsetName = (cached.adset_name as string) || `Conjunto: ${a.title.slice(0, 30)}`;

      if (!setMap.has(adsetId)) {
        setMap.set(adsetId, {
          id: adsetId,
          name: adsetName,
          status: a.status === "paused" ? "paused" : "active",
          campaign_id: a.campaign_id,
          daily_budget_cents: 2000,
          optimization_goal: "CONVERSATIONS",
        });
      }
    }

    // Se ainda vazio, cria 1 conjunto por campanha
    if (setMap.size === 0) {
      for (const c of campaigns) {
        const id = `adset_${c.meta_campaign_id || c.id}`;
        setMap.set(id, {
          id,
          name: `Conjunto Principal · ${c.name}`,
          status: c.status,
          campaign_id: c.id,
          daily_budget_cents: c.budget_daily_cents || 2000,
          optimization_goal: "CONVERSATIONS",
        });
      }
    }

    return Array.from(setMap.values());
  }, [adsets, angles, campaigns]);

  // Helper de métricas agregadas por ID de campanha
  const getMetricsForCampaign = useCallback(
    (camp: Campaign) => {
      const matching = metrics.filter(
        (m) => m.campaign_id === camp.id || (camp.meta_campaign_id && m.meta_campaign_id === camp.meta_campaign_id)
      );

      let spend = 0;
      let impressions = 0;
      let clicks = 0;
      let leads = 0;

      if (matching.length > 0) {
        for (const m of matching) {
          spend += m.spend_cents;
          impressions += m.impressions;
          clicks += m.clicks;
          leads += m.conversions;
        }
      } else {
        const campAngles = angles.filter((a) => a.campaign_id === camp.id);
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

      return { spend, impressions, clicks, ctr, cpc, leads, cpl };
    },
    [metrics, angles]
  );

  // Helper de métricas por AdSet
  const getMetricsForAdSet = useCallback(
    (adset: MetaRealAdSet) => {
      const matchingAngles = angles.filter((a) => {
        const cached = (a.metrics_cached as Record<string, unknown> | null) || {};
        return cached.adset_id === adset.id || a.campaign_id === adset.campaign_id;
      });

      let spend = 0;
      let impressions = 0;
      let clicks = 0;
      let leads = 0;

      for (const a of matchingAngles) {
        const cached = (a.metrics_cached as Record<string, number | undefined> | null) || {};
        spend += cached.spend_cents ?? 0;
        impressions += cached.impressions ?? 0;
        clicks += cached.clicks ?? 0;
        leads += cached.leads ?? cached.conversions ?? 0;
      }

      // Se zero, tenta buscar métricas da campanha proporcionalmente
      if (spend === 0) {
        const camp = campaigns.find((c) => c.id === adset.campaign_id || c.meta_campaign_id === adset.campaign_id);
        if (camp) {
          const m = getMetricsForCampaign(camp);
          spend = m.spend;
          impressions = m.impressions;
          clicks = m.clicks;
          leads = m.leads;
        }
      }

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? Math.round(spend / clicks) : 0;
      const cpl = leads > 0 ? Math.round(spend / leads) : 0;

      return { spend, impressions, clicks, ctr, cpc, leads, cpl };
    },
    [angles, campaigns, getMetricsForCampaign]
  );

  // Helper de métricas por Anúncio
  const getMetricsForAd = useCallback(
    (angle: Angle) => {
      const matching = metrics.filter(
        (m) => angle.meta_ad_id && m.meta_ad_id === angle.meta_ad_id
      );

      let spend = 0;
      let impressions = 0;
      let clicks = 0;
      let leads = 0;

      if (matching.length > 0) {
        for (const m of matching) {
          spend += m.spend_cents;
          impressions += m.impressions;
          clicks += m.clicks;
          leads += m.conversions;
        }
      } else {
        const cached = (angle.metrics_cached as Record<string, number | undefined> | null) || {};
        spend = cached.spend_cents ?? 0;
        impressions = cached.impressions ?? 0;
        clicks = cached.clicks ?? 0;
        leads = cached.leads ?? cached.conversions ?? 0;
      }

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? Math.round(spend / clicks) : 0;
      const cpl = leads > 0 ? Math.round(spend / leads) : 0;

      return { spend, impressions, clicks, ctr, cpc, leads, cpl };
    },
    [metrics]
  );

  // Filtragem de Campanhas
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = c.name.toLowerCase().includes(q) || (c.meta_campaign_id && c.meta_campaign_id.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (statusFilter === "active") return c.status === "active";
      if (statusFilter === "paused") return c.status !== "active";
      return true;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Filtragem de AdSets
  const filteredAdSets = useMemo(() => {
    return effectiveAdSets.filter((s) => {
      if (selectedCampaignId) {
        const camp = campaigns.find((c) => c.id === selectedCampaignId || c.meta_campaign_id === selectedCampaignId);
        const matchCamp = s.campaign_id === selectedCampaignId || (camp && s.campaign_id === camp.id);
        if (!matchCamp) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (statusFilter === "active") return s.status === "active";
      if (statusFilter === "paused") return s.status !== "active";
      return true;
    });
  }, [effectiveAdSets, selectedCampaignId, campaigns, searchQuery, statusFilter]);

  // Filtragem de Anúncios
  const filteredAds = useMemo(() => {
    return angles.filter((a) => {
      if (selectedCampaignId) {
        const camp = campaigns.find((c) => c.id === selectedCampaignId || c.meta_campaign_id === selectedCampaignId);
        const matchCamp = a.campaign_id === selectedCampaignId || (camp && a.campaign_id === camp.id);
        if (!matchCamp) return false;
      }
      if (selectedAdSetId) {
        const cached = (a.metrics_cached as Record<string, unknown> | null) || {};
        if (cached.adset_id && cached.adset_id !== selectedAdSetId) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = a.title.toLowerCase().includes(q) || (a.headline && a.headline.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (statusFilter === "active") return a.status === "winner" || a.status === "testing";
      if (statusFilter === "paused") return a.status === "paused" || a.status === "draft";
      return true;
    });
  }, [angles, selectedCampaignId, selectedAdSetId, campaigns, searchQuery, statusFilter]);

  // Totais do rodapé calculados para o nível atual
  const footerTotals = useMemo(() => {
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;

    if (currentLevel === "campaigns") {
      for (const c of filteredCampaigns) {
        const m = getMetricsForCampaign(c);
        totalSpend += m.spend;
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalLeads += m.leads;
      }
    } else if (currentLevel === "adsets") {
      for (const s of filteredAdSets) {
        const m = getMetricsForAdSet(s);
        totalSpend += m.spend;
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalLeads += m.leads;
      }
    } else {
      for (const a of filteredAds) {
        const m = getMetricsForAd(a);
        totalSpend += m.spend;
        totalImpressions += m.impressions;
        totalClicks += m.clicks;
        totalLeads += m.leads;
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
  }, [currentLevel, filteredCampaigns, filteredAdSets, filteredAds, getMetricsForCampaign, getMetricsForAdSet, getMetricsForAd]);

  return (
    <div className="rounded-xl border bg-card shadow-xs overflow-hidden space-y-0">
      {/* 1. ABAS DE NÍVEIS (Campanhas, Conjuntos de anúncios, Anúncios) no estilo Meta */}
      <div className="flex items-center border-b bg-muted/20 px-3 pt-2 gap-1 overflow-x-auto">
        {/* Aba 1: Campanhas */}
        <button
          type="button"
          onClick={() => setCurrentLevel("campaigns")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            currentLevel === "campaigns"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-background shadow-xs"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <FolderIcon className="size-4 text-blue-500" />
          <span>Campanhas</span>
          {selectedCampaignId ? (
            <span className="flex items-center gap-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 text-[10px] font-bold">
              1 selecionada
            </span>
          ) : (
            <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
              {campaigns.length}
            </span>
          )}
        </button>

        {/* Aba 2: Conjuntos de anúncios */}
        <button
          type="button"
          onClick={() => setCurrentLevel("adsets")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            currentLevel === "adsets"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-background shadow-xs"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <LayoutGridIcon className="size-4 text-blue-500" />
          <span>
            {selectedCampaignId ? "Conjuntos de anúncios para 1 Campanha" : "Conjuntos de anúncios"}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
            {filteredAdSets.length}
          </span>
        </button>

        {/* Aba 3: Anúncios */}
        <button
          type="button"
          onClick={() => setCurrentLevel("ads")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
            currentLevel === "ads"
              ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-background shadow-xs"
              : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <FileTextIcon className="size-4 text-blue-500" />
          <span>
            {selectedCampaignId ? "Anúncios para 1 Campanha" : "Anúncios"}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
            {filteredAds.length}
          </span>
        </button>
      </div>

      {/* 2. BARRA DE FILTROS E DRILL-DOWN estilo Meta Ads Manager */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border-b bg-card">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor com badge caso haja campanha filtrada */}
          {selectedCampaign && (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2.5 py-1 text-xs font-medium">
              <FolderIcon className="size-3.5" />
              <span className="max-w-[200px] truncate">{selectedCampaign.name}</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCampaignId(null);
                  setSelectedAdSetId(null);
                }}
                className="hover:bg-blue-500/20 rounded p-0.5 ml-1"
                title="Limpar seleção de campanha"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          )}

          {/* Campo de pesquisa por texto/ID */}
          <div className="relative min-w-[220px]">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquise por nome, ID ou métrica..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/40"
            />
          </div>

          {/* Filtro de Veiculação (Ativo / Desativado) */}
          <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2 py-1 rounded transition-all font-medium ${
                statusFilter === "all" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2 py-1 rounded transition-all font-medium flex items-center gap-1 ${
                statusFilter === "active" ? "bg-background text-foreground shadow-2xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Ativos
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("paused")}
              className={`px-2 py-1 rounded transition-all font-medium ${
                statusFilter === "paused" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Desativados
            </button>
          </div>
        </div>

        {dateRange && onDateRangeChange ? (
          <MetaDatePicker
            value={dateRange}
            onChange={onDateRangeChange}
          />
        ) : (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 self-end sm:self-auto">
            <span>Últimos 30 dias (Cuiabá)</span>
          </div>
        )}
      </div>

      {/* 3. TABELA DE NÍVEIS COM O LAYOUT EXATO DO GERENCIADOR DE ANÚNCIOS */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/30 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={Boolean(selectedCampaignId)}
                  onChange={() => {
                    if (selectedCampaignId) {
                      setSelectedCampaignId(null);
                      setSelectedAdSetId(null);
                    }
                  }}
                  className="rounded border-muted-foreground/30 text-blue-600 focus:ring-0"
                />
              </th>
              <th className="py-2.5 px-3 w-28">Veiculação</th>
              <th className="py-2.5 px-3 min-w-[240px]">
                {currentLevel === "campaigns"
                  ? "Campanha"
                  : currentLevel === "adsets"
                  ? "Conjunto de anúncios"
                  : "Anúncio"}
              </th>
              <th className="py-2.5 px-3 text-right">Orçamento</th>
              <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                Resultados
              </th>
              <th className="py-2.5 px-3 text-right">Custo / Resultado</th>
              <th className="py-2.5 px-3 text-right">Valor Usado</th>
              <th className="py-2.5 px-3 text-right">Impressões</th>
              <th className="py-2.5 px-3 text-right">Cliques no link</th>
              <th className="py-2.5 px-3 text-right">CTR (link)</th>
              <th className="py-2.5 px-3 text-right">CPC (link)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border font-normal">
            {/* ----------------- NÍVEL 1: CAMPANHAS ----------------- */}
            {currentLevel === "campaigns" &&
              filteredCampaigns.map((camp) => {
                const isActive = camp.status === "active";
                const isSelected = selectedCampaignId === camp.id || selectedCampaignId === camp.meta_campaign_id;
                const m = getMetricsForCampaign(camp);

                return (
                  <tr
                    key={camp.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      isSelected ? "bg-blue-500/10 dark:bg-blue-500/15" : ""
                    }`}
                  >
                    {/* Checkbox de seleção para drill-down */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedCampaignId(null);
                          } else {
                            setSelectedCampaignId(camp.id);
                          }
                        }}
                        className="rounded border-muted-foreground/30 text-blue-600 focus:ring-0"
                      />
                    </td>

                    {/* Veiculação (Switch Toggle On/Off estilo Meta) */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {/* Toggle switch visual */}
                        <div
                          className={`w-8 h-4.5 flex items-center rounded-full p-0.5 cursor-default transition-colors ${
                            isActive ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <div
                            className={`bg-white size-3.5 rounded-full shadow-md transform transition-transform ${
                              isActive ? "translate-x-3.5" : "translate-x-0"
                            }`}
                          />
                        </div>
                        <span className="flex items-center gap-1 text-[11px] font-medium">
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                            }`}
                          />
                          {isActive ? "Ativo" : "Desativado"}
                        </span>
                      </div>
                    </td>

                    {/* Nome da Campanha (clicável para navegar até conjuntos) */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCampaignId(camp.id);
                            setCurrentLevel("adsets");
                          }}
                          className="font-semibold text-foreground hover:text-blue-600 hover:underline text-left text-sm line-clamp-1 cursor-pointer"
                          title="Clique para ver os Conjuntos de Anúncios desta campanha"
                        >
                          {camp.name}
                        </button>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {camp.meta_campaign_id && (
                            <span className="font-mono bg-muted/60 px-1 py-0.2 rounded">
                              ID: {camp.meta_campaign_id}
                            </span>
                          )}
                          <span>WhatsApp Leads</span>
                        </div>
                      </div>
                    </td>

                    {/* Orçamento */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {camp.budget_daily_cents > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">
                            {formatCentsToBrl(camp.budget_daily_cents)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Diário</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Usando o orçamento...</span>
                      )}
                    </td>

                    {/* Resultados (Leads) */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {m.leads > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {m.leads}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Conversas por mensagem</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Custo por Resultado */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {m.cpl > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {formatCentsToBrl(m.cpl)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Por conversa</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Valor Usado (Gasto) */}
                    <td className="py-3 px-3 text-right font-medium text-foreground whitespace-nowrap">
                      {formatCentsToBrl(m.spend)}
                    </td>

                    {/* Impressões */}
                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {m.impressions.toLocaleString("pt-BR")}
                    </td>

                    {/* Cliques no Link */}
                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {m.clicks.toLocaleString("pt-BR")}
                    </td>

                    {/* CTR (link) */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className={`font-semibold ${m.ctr > 1.5 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {formatPercent(m.ctr)}
                      </span>
                    </td>

                    {/* CPC (link) */}
                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {formatCentsToBrl(m.cpc)}
                    </td>
                  </tr>
                );
              })}

            {/* ----------------- NÍVEL 2: CONJUNTOS DE ANÚNCIOS ----------------- */}
            {currentLevel === "adsets" &&
              filteredAdSets.map((set) => {
                const isActive = set.status === "active";
                const isSelected = selectedAdSetId === set.id;
                const m = getMetricsForAdSet(set);
                const parentCamp = campaigns.find((c) => c.id === set.campaign_id || c.meta_campaign_id === set.campaign_id);

                return (
                  <tr
                    key={set.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      isSelected ? "bg-blue-500/10 dark:bg-blue-500/15" : ""
                    }`}
                  >
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isSelected) {
                            setSelectedAdSetId(null);
                          } else {
                            setSelectedAdSetId(set.id);
                          }
                        }}
                        className="rounded border-muted-foreground/30 text-blue-600 focus:ring-0"
                      />
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-4.5 flex items-center rounded-full p-0.5 cursor-default transition-colors ${
                            isActive ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <div
                            className={`bg-white size-3.5 rounded-full shadow-md transform transition-transform ${
                              isActive ? "translate-x-3.5" : "translate-x-0"
                            }`}
                          />
                        </div>
                        <span className="flex items-center gap-1 text-[11px] font-medium">
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                            }`}
                          />
                          {isActive ? "Ativo" : "Desativado"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdSetId(set.id);
                            setCurrentLevel("ads");
                          }}
                          className="font-semibold text-foreground hover:text-blue-600 hover:underline text-left text-sm line-clamp-1 cursor-pointer"
                          title="Clique para ver os Anúncios deste conjunto"
                        >
                          {set.name}
                        </button>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {parentCamp && <span>Campanha: {parentCamp.name}</span>}
                          <span className="font-mono bg-muted/60 px-1 py-0.2 rounded">
                            ID: {set.id}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {set.daily_budget_cents ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground">
                            {formatCentsToBrl(set.daily_budget_cents)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Diário</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Usando o orçamento...</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {m.leads > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {m.leads}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Conversas por mensagem</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {m.cpl > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {formatCentsToBrl(m.cpl)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Por conversa</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-foreground whitespace-nowrap">
                      {formatCentsToBrl(m.spend)}
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {m.impressions.toLocaleString("pt-BR")}
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {m.clicks.toLocaleString("pt-BR")}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className={`font-semibold ${m.ctr > 1.5 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {formatPercent(m.ctr)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {formatCentsToBrl(m.cpc)}
                    </td>
                  </tr>
                );
              })}

            {/* ----------------- NÍVEL 3: ANÚNCIOS ----------------- */}
            {currentLevel === "ads" &&
              filteredAds.map((ad) => {
                const isActive = ad.status === "winner" || ad.status === "testing";
                const m = getMetricsForAd(ad);
                const parentCamp = campaigns.find((c) => c.id === ad.campaign_id);

                return (
                  <tr key={ad.id} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-muted-foreground/30 text-blue-600 focus:ring-0"
                      />
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-4.5 flex items-center rounded-full p-0.5 cursor-default transition-colors ${
                            isActive ? "bg-blue-600" : "bg-muted-foreground/30"
                          }`}
                        >
                          <div
                            className={`bg-white size-3.5 rounded-full shadow-md transform transition-transform ${
                              isActive ? "translate-x-3.5" : "translate-x-0"
                            }`}
                          />
                        </div>
                        <span className="flex items-center gap-1 text-[11px] font-medium">
                          <span
                            className={`size-1.5 rounded-full ${
                              isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/50"
                            }`}
                          />
                          {isActive ? "Ativo" : "Desativado"}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground text-sm line-clamp-1">
                          {ad.title}
                        </span>
                        {ad.headline && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                            &ldquo;{ad.headline}&rdquo;
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {parentCamp && <span>Campanha: {parentCamp.name}</span>}
                          {ad.meta_ad_id && (
                            <span className="font-mono bg-muted/60 px-1 py-0.2 rounded">
                              ID: {ad.meta_ad_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground text-[11px] whitespace-nowrap">
                      Usando conjunto
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {m.leads > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                            {m.leads}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Conversas por mensagem</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {m.cpl > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-semibold text-orange-600 dark:text-orange-400">
                            {formatCentsToBrl(m.cpl)}
                          </span>
                          <span className="block text-[10px] text-muted-foreground">Por conversa</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-foreground whitespace-nowrap">
                      {formatCentsToBrl(m.spend)}
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {m.impressions.toLocaleString("pt-BR")}
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {m.clicks.toLocaleString("pt-BR")}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <span className={`font-semibold ${m.ctr > 1.5 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                        {formatPercent(m.ctr)}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right text-muted-foreground whitespace-nowrap">
                      {formatCentsToBrl(m.cpc)}
                    </td>
                  </tr>
                );
              })}
          </tbody>

          {/* 4. LINHA DE TOTAIS NO RODAPÉ (Exatamente como no Gerenciador de Anúncios) */}
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40 font-semibold text-foreground">
              <td className="py-3 px-3 text-center" />
              <td className="py-3 px-3" />
              <td className="py-3 px-3">
                <span className="font-bold text-xs">
                  Resultados de{" "}
                  {currentLevel === "campaigns"
                    ? `${filteredCampaigns.length} campanhas`
                    : currentLevel === "adsets"
                    ? `${filteredAdSets.length} conjuntos de anúncios`
                    : `${filteredAds.length} anúncios`}
                </span>
              </td>
              <td className="py-3 px-3 text-right text-muted-foreground text-[11px]">—</td>
              <td className="py-3 px-3 text-right">
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {footerTotals.totalLeads}
                </span>
                <span className="block text-[10px] text-muted-foreground font-normal">
                  Total de Conversas
                </span>
              </td>
              <td className="py-3 px-3 text-right">
                <span className="font-bold text-orange-600 dark:text-orange-400">
                  {formatCentsToBrl(footerTotals.avgCpl)}
                </span>
                <span className="block text-[10px] text-muted-foreground font-normal">Média</span>
              </td>
              <td className="py-3 px-3 text-right font-black">
                {formatCentsToBrl(footerTotals.totalSpend)}
              </td>
              <td className="py-3 px-3 text-right text-muted-foreground">
                {footerTotals.totalImpressions.toLocaleString("pt-BR")}
              </td>
              <td className="py-3 px-3 text-right text-muted-foreground">
                {footerTotals.totalClicks.toLocaleString("pt-BR")}
              </td>
              <td className="py-3 px-3 text-right font-bold text-blue-600 dark:text-blue-400">
                {formatPercent(footerTotals.avgCtr)}
              </td>
              <td className="py-3 px-3 text-right text-muted-foreground">
                {formatCentsToBrl(footerTotals.avgCpc)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
