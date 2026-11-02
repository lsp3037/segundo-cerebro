"use client";

import { useState } from "react";
import {
  SparklesIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
  TrophyIcon,
  CheckCircle2Icon,
  BarChart3Icon,
  ZapIcon,
  MessageSquareIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  analyzeCampaignsWithAi,
  type CampaignDiagnosticReport,
  type CampaignSummaryInput,
} from "@/lib/actions/meta-ads-sync";

interface AiCampaignDiagnosticsProps {
  totalSpendCents: number;
  totalClicks: number;
  totalLeads: number;
  avgCtr: number;
  topAngleTitle?: string;
  periodLabel?: string;
  campaigns?: CampaignSummaryInput[];
}

export function AiCampaignDiagnostics({
  totalSpendCents,
  totalClicks,
  totalLeads,
  avgCtr,
  topAngleTitle,
  periodLabel = "Últimos 30 dias",
  campaigns = [],
}: AiCampaignDiagnosticsProps) {
  const [activeTab, setActiveTab] = useState<"general" | "sobral">("general");
  const [generalReport, setGeneralReport] = useState<CampaignDiagnosticReport | null>(null);
  const [sobralReport, setSobralReport] = useState<CampaignDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);

  const currentReport = activeTab === "general" ? generalReport : sobralReport;

  const handleGenerate = async (typeToGenerate = activeTab) => {
    setLoading(true);
    const label = typeToGenerate === "general" ? "Análise Geral das Campanhas" : "Metodologia Pedro Sobral";
    toast.info(`Gerando ${label} para ${periodLabel}...`);

    try {
      const res = await analyzeCampaignsWithAi({
        totalSpendCents,
        totalClicks,
        totalLeads,
        avgCtr,
        topAngleTitle,
        analysisType: typeToGenerate,
        periodLabel,
        campaigns,
      });

      if (res.ok) {
        if (typeToGenerate === "general") {
          setGeneralReport(res.data);
        } else {
          setSobralReport(res.data);
        }
        toast.success(`${label} gerada com sucesso!`);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao gerar diagnóstico de IA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card via-card to-orange-500/5 p-5 shadow-2xs space-y-4">
      {/* Barra de Abas do Diagnóstico (Geral vs Pedro Sobral) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0">
            <SparklesIcon className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base leading-tight">Parecer Consultivo com IA</h3>
              <span className="text-[11px] text-muted-foreground">({periodLabel})</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Análise factual baseada estritamente nas campanhas reais cadastradas na conta.
            </p>
          </div>
        </div>

        {/* Seletor de Tipo de Análise */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border bg-muted/50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === "general"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3Icon className="size-3.5 text-blue-500" />
              Análise Geral da Conta
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("sobral")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === "sobral"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ZapIcon className="size-3.5 text-orange-500" />
              Metodologia Sobral
            </button>
          </div>

          <Button
            type="button"
            onClick={() => handleGenerate(activeTab)}
            disabled={loading}
            size="sm"
            className="h-8 gap-1.5 text-xs bg-orange-600 hover:bg-orange-700 text-white shrink-0"
          >
            <SparklesIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Analisando..." : currentReport ? "Atualizar Análise" : "Gerar Análise"}
          </Button>
        </div>
      </div>

      {/* Conteúdo da Análise */}
      {!currentReport ? (
        <div className="py-8 text-center space-y-2">
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            {activeTab === "general" ? (
              <>
                Clique em <strong>Gerar Análise</strong> para ver a leitura factual das suas campanhas reais: desempenho da campanha ativa de Dobradiça, histórico da campanha Trust Care, custo por clique (CPC) e conversas de WhatsApp.
              </>
            ) : (
              <>
                Clique em <strong>Gerar Análise</strong> para ver a <strong>Metodologia Pedro Sobral</strong> aplicada às suas campanhas: validação de ganchos em Cuiabá, volume de cliques e diretriz prática de orçamento.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Header do Relatório Atual */}
          <div
            className={`rounded-lg border p-3.5 space-y-1.5 ${
              activeTab === "general"
                ? "bg-blue-500/10 border-blue-500/20 text-foreground"
                : "bg-orange-500/10 border-orange-500/20 text-foreground"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                  activeTab === "general" ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {activeTab === "general" ? (
                  <>
                    <BarChart3Icon className="size-3.5" />
                    Diagnóstico Geral das Campanhas Reais
                  </>
                ) : (
                  <>
                    <ZapIcon className="size-3.5" />
                    Diagnóstico Tático Pedro Sobral (Ninja do Tráfego)
                  </>
                )}
              </span>
              <Badge
                className={
                  currentReport.status_badge === "healthy"
                    ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-600 border-amber-500/30"
                }
              >
                {currentReport.status_badge === "healthy" ? "Saudável" : "Requer Atenção"}
              </Badge>
            </div>
            <p className="text-sm font-medium leading-relaxed">{currentReport.executive_summary}</p>
          </div>

          {/* Cards de Métricas e Recomendações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Campanha em Destaque */}
            <div className="rounded-lg border bg-card p-3.5 space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrophyIcon className="size-3.5 text-emerald-500" />
                {activeTab === "general" ? "Campanha em Destaque" : "Criativo Campeão (Novo Público)"}
              </span>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {currentReport.best_angle_name}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeTab === "general"
                  ? "Campanha com veiculação ativa ou maior tração histórica identificada na conta."
                  : "Criativo que melhor segmentou o público de Cuiabá com menor custo por mensagem no WhatsApp."}
              </p>
            </div>

            {/* Gestão de Orçamento */}
            <div className="rounded-lg border bg-card p-3.5 space-y-1.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUpIcon className="size-3.5 text-blue-500" />
                {activeTab === "general" ? "Gestão do Orçamento Diário" : "Diretriz de Orçamento (ABO vs CBO)"}
              </span>
              <p className="text-xs font-medium leading-relaxed text-foreground">
                {currentReport.budget_adjustment_suggestion}
              </p>
            </div>
          </div>

          {/* Dica Comercial de Atendimento WhatsApp */}
          {currentReport.commercial_funnel_notes && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-1">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <MessageSquareIcon className="size-3.5" />
                Diretriz de Atendimento no WhatsApp
              </span>
              <p className="text-xs text-foreground leading-relaxed">
                {currentReport.commercial_funnel_notes}
              </p>
            </div>
          )}

          {/* Plano de Ação Recomendado */}
          {currentReport.recommended_actions?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {activeTab === "general" ? "Ações Práticas Recomendadas:" : "Ações Recomendadas (Vai lá e faz):"}
              </span>
              <div className="space-y-1.5">
                {currentReport.recommended_actions.map((act, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <CheckCircle2Icon
                      className={`size-3.5 mt-0.5 shrink-0 ${
                        activeTab === "general" ? "text-blue-500" : "text-orange-500"
                      }`}
                    />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alertas Fatuais sobre Status das Campanhas */}
          {currentReport.fatigued_creatives?.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangleIcon className="size-3.5" />
                {activeTab === "general" ? "Status & Observações das Campanhas" : "Alerta de Fadiga & Problema da Raposa"}
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {currentReport.fatigued_creatives.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
