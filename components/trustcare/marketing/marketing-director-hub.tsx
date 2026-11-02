"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  MegaphoneIcon,
  VideoIcon,
  TargetIcon,
  BarChart3Icon,
  CalendarIcon,
} from "lucide-react";

import { formatCentsToBrl } from "./meta";
import { ContentPlannerBoard } from "./content-planner/content-planner-board";
import { CampaignsTimeline } from "./campaigns/campaigns-timeline";
import { AnglesMatrix } from "./campaigns/angles-matrix";
import { AdsAnalyzerDashboard } from "./ads-analyzer/ads-analyzer-dashboard";
import type { Tables } from "@/lib/supabase/database.types";
import type { Folder } from "@/lib/modules";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;
type Metric = Tables<"meta_ads_metrics">;
type Idea = Tables<"content_ideas">;

interface MarketingDirectorHubProps {
  folder: Folder;
  initialCampaigns: Campaign[];
  initialAngles: Angle[];
  initialMetrics: Metric[];
  initialScripts: Idea[];
}

export function MarketingDirectorHub({
  folder,
  initialCampaigns,
  initialAngles,
  initialMetrics,
  initialScripts,
}: MarketingDirectorHubProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"planner" | "campaigns" | "analyzer">("planner");
  const [campaignSubView, setCampaignSubView] = useState<"timeline" | "matrix">("timeline");
  const [selectedCampaignForAngles, setSelectedCampaignForAngles] = useState<string | undefined>(undefined);

  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [angles, setAngles] = useState<Angle[]>(initialAngles);
  const metrics = initialMetrics;

  // Resumo executivo do topo
  const executiveHeader = useMemo(() => {
    const activeCampaignsCount = campaigns.filter((c) => c.status === "active").length;
    const totalDailyBudgetCents = campaigns
      .filter((c) => c.status === "active")
      .reduce((sum, c) => sum + (c.budget_daily_cents || 0), 0);
    const totalMonthlyBudgetCents = totalDailyBudgetCents * 30;
    const winnerAnglesCount = angles.filter((a) => a.status === "winner").length;

    return {
      activeCampaignsCount,
      totalDailyBudgetCents,
      totalMonthlyBudgetCents,
      winnerAnglesCount,
    };
  }, [campaigns, angles]);

  const handleSelectCampaignForAngles = (campaignId: string) => {
    setSelectedCampaignForAngles(campaignId);
    setCampaignSubView("matrix");
  };

  return (
    <div className="space-y-6 px-4 py-4 md:px-6">
      {/* Header Executivo da Diretoria de Marketing */}
      <div className="rounded-2xl border bg-gradient-to-r from-card via-card to-orange-500/10 p-5 md:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-sm">
                <MegaphoneIcon className="size-5" />
              </span>
              <div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                  Diretoria de Marketing • Trust Care
                </h2>
                <p className="text-xs text-muted-foreground">
                  Central de crescimento: roteirização de alta conversão, testes de ângulos e tráfego Meta Ads em Cuiabá.
                </p>
              </div>
            </div>
          </div>

          {/* Cards de Resumo Rápido no Header */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border bg-background/80 backdrop-blur-xs px-3.5 py-2 text-left shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Campanhas Ativas
              </span>
              <span className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                {executiveHeader.activeCampaignsCount} ativas
              </span>
            </div>

            <div className="rounded-xl border bg-background/80 backdrop-blur-xs px-3.5 py-2 text-left shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Orçamento Diário Ativo
              </span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatCentsToBrl(executiveHeader.totalDailyBudgetCents)}/dia
              </span>
            </div>

            <div className="rounded-xl border bg-background/80 backdrop-blur-xs px-3.5 py-2 text-left shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Ângulos Vencedores
              </span>
              <span className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                🏆 {executiveHeader.winnerAnglesCount} validados
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegação entre as 3 Abas Principais */}
      <div className="flex border-b border-border/80">
        <nav className="flex space-x-1 sm:space-x-3 -mb-px" aria-label="Abas da Diretoria de Marketing">
          <button
            type="button"
            onClick={() => setActiveTab("planner")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-sm font-semibold transition-colors ${
              activeTab === "planner"
                ? "border-orange-600 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <VideoIcon className="size-4" />
            <span>Planejador de Conteúdo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("campaigns")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-sm font-semibold transition-colors ${
              activeTab === "campaigns"
                ? "border-orange-600 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <TargetIcon className="size-4" />
            <span>Campanhas & Matriz de Ângulos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("analyzer")}
            className={`flex items-center gap-2 border-b-2 py-3 px-3 sm:px-4 text-sm font-semibold transition-colors ${
              activeTab === "analyzer"
                ? "border-orange-600 text-orange-600 dark:text-orange-400"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <BarChart3Icon className="size-4" />
            <span>Analisador Meta Ads</span>
          </button>
        </nav>
      </div>

      {/* Conteúdo da Aba 1: Planejador de Conteúdo */}
      {activeTab === "planner" && (
        <ContentPlannerBoard initialScripts={initialScripts} folderId={folder.id} />
      )}

      {/* Conteúdo da Aba 2: Campanhas & Matriz de Ângulos */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          {/* Sub-toggle: Linha do Tempo / Matriz de Ângulos */}
          <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setCampaignSubView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                campaignSubView === "timeline"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarIcon className="size-3.5" />
              Linha do Tempo de Campanhas ({campaigns.length})
            </button>
            <button
              type="button"
              onClick={() => setCampaignSubView("matrix")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                campaignSubView === "matrix"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TargetIcon className="size-3.5" />
              Matriz de Ângulos de Anúncios ({angles.length})
            </button>
          </div>

          {campaignSubView === "timeline" ? (
            <CampaignsTimeline
              campaigns={campaigns}
              angles={angles}
              folderId={folder.id}
              onSelectCampaignForAngles={handleSelectCampaignForAngles}
              onCampaignUpdated={setCampaigns}
            />
          ) : (
            <AnglesMatrix
              campaigns={campaigns}
              initialAngles={angles}
              selectedCampaignId={selectedCampaignForAngles}
              onAnglesUpdated={setAngles}
            />
          )}
        </div>
      )}

      {/* Conteúdo da Aba 3: Analisador Meta Ads */}
      {activeTab === "analyzer" && (
        <AdsAnalyzerDashboard
          campaigns={campaigns}
          angles={angles}
          metrics={metrics}
          onRefreshMetrics={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
