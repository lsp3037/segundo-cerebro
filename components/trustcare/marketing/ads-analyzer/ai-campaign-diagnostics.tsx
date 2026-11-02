"use client";

import { useState } from "react";
import { SparklesIcon, TrendingUpIcon, AlertTriangleIcon, TrophyIcon, CheckCircle2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeCampaignsWithAi, type CampaignDiagnosticReport } from "@/lib/actions/meta-ads-sync";

interface AiCampaignDiagnosticsProps {
  totalSpendCents: number;
  totalClicks: number;
  totalLeads: number;
  avgCtr: number;
  topAngleTitle?: string;
}

export function AiCampaignDiagnostics({
  totalSpendCents,
  totalClicks,
  totalLeads,
  avgCtr,
  topAngleTitle,
}: AiCampaignDiagnosticsProps) {
  const [report, setReport] = useState<CampaignDiagnosticReport | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    toast.info("A IA com metodologia Pedro Sobral está analisando seus dados de tráfego...");
    try {
      const res = await analyzeCampaignsWithAi({
        totalSpendCents,
        totalClicks,
        totalLeads,
        avgCtr,
        topAngleTitle,
      });

      if (res.ok) {
        setReport(res.data);
        toast.success("Parecer executivo gerado com metodologia Sobral!");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao gerar diagnóstico.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border bg-gradient-to-br from-card via-card to-orange-500/5 p-5 shadow-2xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
            <SparklesIcon className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-base leading-tight">Parecer Consultivo · Metodologia Pedro Sobral</h3>
              <span className="rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 px-2 py-0.5 text-[10px] font-bold">
                Ninja do Tráfego
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Diretrizes de tráfego pago: &ldquo;Criativo é o novo público&rdquo;, controle de CPL e ação imediata em Cuiabá.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          variant="outline"
          size="sm"
          className="gap-1.5 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
        >
          <SparklesIcon className="size-3.5" />
          {loading ? "Consultando Sobral..." : report ? "Atualizar Análise" : "Gerar Análise Sobral"}
        </Button>
      </div>

      {!report ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Clique no botão acima para que a IA analise suas métricas sob a ótica de <strong>Pedro Sobral</strong>: validação de criativos, custo por conversa de WhatsApp e otimização cirúrgica de verba.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-1">
          {/* Resumo Executivo */}
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUpIcon className="size-3.5" />
                Diagnóstico de Tráfego (Pedro Sobral)
              </span>
              <Badge className={
                report.status_badge === "healthy"
                  ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-600 border-amber-500/30"
              }>
                {report.status_badge === "healthy" ? "Saudável" : "Requer Atenção"}
              </Badge>
            </div>
            <p className="text-sm font-medium leading-relaxed">{report.executive_summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Ângulo Vencedor */}
            <div className="rounded-lg border bg-card p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrophyIcon className="size-3.5 text-emerald-500" />
                Criativo Campeão (Novo Público)
              </span>
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {report.best_angle_name}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este criativo filtrou o público mais qualificado de Cuiabá com menor custo por mensagem no WhatsApp.
              </p>
            </div>

            {/* Ajuste de Orçamento */}
            <div className="rounded-lg border bg-card p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUpIcon className="size-3.5 text-blue-500" />
                Diretriz de Orçamento (ABO vs CBO)
              </span>
              <p className="text-xs font-medium leading-relaxed text-foreground">
                {report.budget_adjustment_suggestion}
              </p>
            </div>
          </div>

          {/* Plano de Ação Recomendado */}
          {report.recommended_actions?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Ações Recomendadas (Vai lá e faz):
              </span>
              <div className="space-y-1.5">
                {report.recommended_actions.map((act, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <CheckCircle2Icon className="size-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Criativos Fadigados & Alertas */}
          {report.fatigued_creatives?.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
              <span className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangleIcon className="size-3.5" />
                Alerta de Fadiga &amp; &ldquo;Problema da Raposa&rdquo;
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {report.fatigued_creatives.map((f, i) => (
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
