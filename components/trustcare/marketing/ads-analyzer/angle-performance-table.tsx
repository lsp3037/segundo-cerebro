"use client";

import { TrophyIcon } from "lucide-react";
import { formatCentsToBrl, formatPercent } from "../meta";
import type { Tables } from "@/lib/supabase/database.types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;

interface AnglePerformanceTableProps {
  angles: Angle[];
  campaigns: Campaign[];
}

export function AnglePerformanceTable({
  angles,
  campaigns,
}: AnglePerformanceTableProps) {
  if (angles.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-xs text-muted-foreground">
        Nenhum ângulo disponível para comparar métricas.
      </div>
    );
  }

  // Prepara dados com métricas reais cacheadas
  const rows = angles.map((angle) => {
    const campaign = campaigns.find((c) => c.id === angle.campaign_id);
    const metrics = (angle.metrics_cached as Record<string, number | undefined> | null) || {};

    const spend = metrics.spend_cents ?? 0;
    const clicks = metrics.clicks ?? 0;
    const ctr = metrics.ctr ?? 0;
    const cpc = metrics.cpc_cents ?? (clicks > 0 ? Math.round(spend / clicks) : 0);
    const leads = metrics.leads ?? metrics.conversions ?? 0;
    const cpl = metrics.cpl_cents ?? (leads > 0 ? Math.round(spend / leads) : 0);

    return {
      angle,
      campaignName: campaign?.name ?? "Geral",
      spend,
      clicks,
      ctr,
      cpc,
      leads,
      cpl,
    };
  });

  // Ordena pelo maior número de leads ou melhor CTR
  rows.sort((a, b) => b.leads - a.leads);

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-2xs space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">Comparativo de Performance por Ângulo</h4>
          <p className="text-xs text-muted-foreground">
            Métricas de tráfego pago consolidadas para Cuiabá e Várzea Grande.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3">Ângulo / Headline</th>
              <th className="py-2.5 px-3">Campanha</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Gasto (R$)</th>
              <th className="py-2.5 px-3 text-right">Cliques</th>
              <th className="py-2.5 px-3 text-right">CTR</th>
              <th className="py-2.5 px-3 text-right">CPC Médio</th>
              <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                Leads Zap
              </th>
              <th className="py-2.5 px-3 text-right">Custo / Lead</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(({ angle, campaignName, spend, clicks, ctr, cpc, leads, cpl }) => {
              return (
                <tr
                  key={angle.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    angle.status === "winner" ? "bg-emerald-500/5 font-medium" : ""
                  }`}
                >
                  <td className="py-3 px-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {angle.status === "winner" && (
                          <TrophyIcon className="size-3 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-semibold text-foreground line-clamp-1">{angle.title}</span>
                      </div>
                      {angle.headline && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                          &ldquo;{angle.headline}&rdquo;
                        </p>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate">
                    {campaignName}
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        angle.status === "winner"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {angle.status === "winner" ? "Winner 🏆" : angle.status}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right font-medium">
                    {formatCentsToBrl(spend)}
                  </td>

                  <td className="py-3 px-3 text-right font-medium">
                    {clicks}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <span className={`font-semibold ${ctr >= 2.0 ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                      {formatPercent(ctr)}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-right text-muted-foreground">
                    {formatCentsToBrl(cpc)}
                  </td>

                  <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {leads}
                  </td>

                  <td className="py-3 px-3 text-right font-semibold">
                    {cpl > 0 ? formatCentsToBrl(cpl) : "-"}
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
