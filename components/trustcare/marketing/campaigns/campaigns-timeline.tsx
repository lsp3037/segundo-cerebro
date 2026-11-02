"use client";

import { useState } from "react";
import {
  CalendarIcon,
  DollarSignIcon,
  PlusIcon,
  MegaphoneIcon,
  UsersIcon,
  FileEditIcon,
  Trash2Icon,
  TargetIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CAMPAIGN_OBJECTIVES,
  CAMPAIGN_STATUSES,
  formatCentsToBrl,
  labelOf,
} from "../meta";
import { CampaignDialog } from "./campaign-dialog";
import { deleteCampaign } from "@/lib/actions/marketing-campaigns";
import type { Tables } from "@/lib/supabase/database.types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;

interface CampaignsTimelineProps {
  campaigns: Campaign[];
  angles: Angle[];
  folderId?: string;
  onSelectCampaignForAngles?: (campaignId: string) => void;
  onCampaignUpdated: (campaigns: Campaign[]) => void;
}

export function CampaignsTimeline({
  campaigns,
  angles,
  folderId,
  onSelectCampaignForAngles,
  onCampaignUpdated,
}: CampaignsTimelineProps) {
  const [filter, setFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const filtered = campaigns.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const found = CAMPAIGN_STATUSES.find((s) => s.value === status);
    if (!found) return <Badge variant="secondary">{status}</Badge>;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${found.color}`}>
        {found.label}
      </span>
    );
  };

  const getObjectiveLabel = (obj: string) => {
    return labelOf(CAMPAIGN_OBJECTIVES, obj) || obj;
  };

  const handleDelete = async (id: string) => {
    const res = await deleteCampaign(id);
    if (res.ok) {
      toast.success("Campanha excluída com sucesso.");
      onCampaignUpdated(campaigns.filter((c) => c.id !== id));
    } else {
      toast.error(res.error);
    }
  };

  const handleSaved = (saved: Campaign) => {
    const idx = campaigns.findIndex((c) => c.id === saved.id);
    let next: Campaign[];
    if (idx >= 0) {
      next = [...campaigns];
      next[idx] = saved;
    } else {
      next = [saved, ...campaigns];
    }
    onCampaignUpdated(next);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações e Filtro de Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
              filter === "all"
                ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas ({campaigns.length})
          </button>
          {CAMPAIGN_STATUSES.map((st) => {
            const count = campaigns.filter((c) => c.status === st.value).length;
            if (count === 0 && st.value !== "active" && st.value !== "scheduled") return null;
            return (
              <button
                key={st.value}
                type="button"
                onClick={() => setFilter(st.value)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                  filter === st.value
                    ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 font-semibold"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {st.label} ({count})
              </button>
            );
          })}
        </div>

        <Button
          onClick={() => {
            setEditingCampaign(null);
            setDialogOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
        >
          <PlusIcon className="size-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Lista / Timeline de Campanhas */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 mb-3">
            <MegaphoneIcon className="size-6" />
          </div>
          <h3 className="font-semibold text-base">Nenhuma campanha neste status</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            Estruture suas campanhas com datas, orçamentos em reais e objetivos comerciais claros.
          </p>
          <Button
            onClick={() => {
              setEditingCampaign(null);
              setDialogOpen(true);
            }}
            variant="outline"
            className="gap-1.5"
          >
            <PlusIcon className="size-4" />
            Criar Primeira Campanha
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((campaign) => {
            const campaignAngles = angles.filter((a) => a.campaign_id === campaign.id);
            const winnerAngle = campaignAngles.find((a) => a.status === "winner");

            return (
              <div
                key={campaign.id}
                className="relative rounded-xl border bg-card p-5 shadow-2xs hover:border-orange-500/40 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg leading-tight hover:text-orange-600 cursor-pointer"
                        onClick={() => {
                          setEditingCampaign(campaign);
                          setDialogOpen(true);
                        }}
                      >
                        {campaign.name}
                      </h3>
                      {getStatusBadge(campaign.status)}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <TargetIcon className="size-3.5 text-orange-500" />
                      <span>Objetivo: <strong>{getObjectiveLabel(campaign.objective)}</strong></span>
                      {campaign.meta_campaign_id && (
                        <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded ml-2">
                          ID: {campaign.meta_campaign_id}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingCampaign(campaign);
                        setDialogOpen(true);
                      }}
                      className="h-8 gap-1 text-xs"
                    >
                      <FileEditIcon className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(campaign.id)}
                      className="size-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Métricas e Detalhes da Campanha */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <CalendarIcon className="size-3" />
                      Período (Cuiabá)
                    </span>
                    <p className="font-semibold text-foreground">
                      {campaign.start_date.split("-").reverse().join("/")}
                      {campaign.end_date ? ` até ${campaign.end_date.split("-").reverse().join("/")}` : " (Contínua)"}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <DollarSignIcon className="size-3 text-emerald-500" />
                      Orçamento Diário
                    </span>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatCentsToBrl(campaign.budget_daily_cents)}/dia
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <DollarSignIcon className="size-3 text-emerald-500" />
                      Orçamento Total
                    </span>
                    <p className="font-semibold text-foreground">
                      {formatCentsToBrl(campaign.budget_total_cents)}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-2.5 space-y-1">
                    <span className="text-muted-foreground flex items-center gap-1 text-[11px]">
                      <TargetIcon className="size-3 text-orange-500" />
                      Ângulos em Teste
                    </span>
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <span>{campaignAngles.length} {campaignAngles.length === 1 ? "ângulo" : "ângulos"}</span>
                      {winnerAngle && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 px-1 rounded font-bold">
                          1 Winner
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Público Alvo & Atalho para Matriz de Ângulos */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 text-xs">
                  {campaign.target_audience ? (
                    <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                      <UsersIcon className="size-3.5 shrink-0 text-orange-500" />
                      <span className="truncate">Público: {campaign.target_audience}</span>
                    </div>
                  ) : <div />}

                  {onSelectCampaignForAngles && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onSelectCampaignForAngles(campaign.id)}
                      className="text-xs h-7 gap-1 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 shrink-0 self-end"
                    >
                      <TargetIcon className="size-3" />
                      Ver Matriz de Ângulos
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Campanha */}
      <CampaignDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        folderId={folderId}
        initialData={editingCampaign}
        onSuccess={handleSaved}
      />
    </div>
  );
}
