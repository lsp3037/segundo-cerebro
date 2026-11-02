"use client";

import { useState } from "react";
import {
  TargetIcon,
  PlusIcon,
  TrophyIcon,
  CopyIcon,
  ExternalLinkIcon,
  FileEditIcon,
  Trash2Icon,
  CheckIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  HOOK_ANGLES,
  ANGLE_STATUSES,
  formatCentsToBrl,
  formatPercent,
  type AngleStatus,
} from "../meta";
import { AngleDialog } from "./angle-dialog";
import { updateAngle, deleteAngle } from "@/lib/actions/marketing-campaigns";
import type { Tables } from "@/lib/supabase/database.types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;

interface AnglesMatrixProps {
  campaigns: Campaign[];
  initialAngles: Angle[];
  selectedCampaignId?: string;
  onAnglesUpdated: (angles: Angle[]) => void;
}

export function AnglesMatrix({
  campaigns,
  initialAngles,
  selectedCampaignId,
  onAnglesUpdated,
}: AnglesMatrixProps) {
  const [angles, setAngles] = useState<Angle[]>(initialAngles);
  const [activeCampaignFilter, setActiveCampaignFilter] = useState<string>(
    selectedCampaignId ?? "all"
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAngle, setEditingAngle] = useState<Angle | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredAngles = angles.filter((a) => {
    if (activeCampaignFilter === "all") return true;
    return a.campaign_id === activeCampaignFilter;
  });

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Texto copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkAsWinner = async (angle: Angle) => {
    const isWinner = angle.status === "winner";
    const nextStatus: AngleStatus = isWinner ? "testing" : "winner";

    const res = await updateAngle(angle.id, { status: nextStatus });
    if (res.ok) {
      const updated = angles.map((a) => (a.id === angle.id ? { ...a, status: nextStatus } : a));
      setAngles(updated);
      onAnglesUpdated(updated);
      toast.success(isWinner ? "Status alterado para Em Teste." : "🏆 Ângulo marcado como Vencedor!");
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async (angleId: string) => {
    const res = await deleteAngle(angleId);
    if (res.ok) {
      const next = angles.filter((a) => a.id !== angleId);
      setAngles(next);
      onAnglesUpdated(next);
      toast.success("Ângulo excluído com sucesso.");
    } else {
      toast.error(res.error);
    }
  };

  const handleSaved = (saved: Angle) => {
    const idx = angles.findIndex((a) => a.id === saved.id);
    let next: Angle[];
    if (idx >= 0) {
      next = [...angles];
      next[idx] = saved;
    } else {
      next = [saved, ...angles];
    }
    setAngles(next);
    onAnglesUpdated(next);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtro de Campanha e Ação de Criar Ângulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Filtrar por Campanha:</span>
          <Select value={activeCampaignFilter} onValueChange={setActiveCampaignFilter}>
            <SelectTrigger className="h-8 text-xs w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Campanhas ({angles.length} ângulos)</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={() => {
            if (campaigns.length === 0) {
              toast.error("Crie ao menos uma campanha antes de cadastrar ângulos.");
              return;
            }
            setEditingAngle(null);
            setDialogOpen(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
        >
          <PlusIcon className="size-4" />
          Novo Ângulo de Anúncio
        </Button>
      </div>

      {/* Grid de Ângulos (Matriz Lado a Lado) */}
      {filteredAngles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 mb-3">
            <TargetIcon className="size-6" />
          </div>
          <h3 className="font-semibold text-base">Nenhum ângulo cadastrado nesta campanha</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            A matriz de ângulos permite testar diferentes dores, avatares e headlines contra o mesmo objetivo comercial.
          </p>
          <Button
            onClick={() => {
              if (campaigns.length === 0) {
                toast.error("Crie uma campanha primeiro.");
                return;
              }
              setEditingAngle(null);
              setDialogOpen(true);
            }}
            variant="outline"
            className="gap-1.5"
          >
            <PlusIcon className="size-4" />
            Cadastrar Primeiro Ângulo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAngles.map((angle) => {
            const camp = campaigns.find((c) => c.id === angle.campaign_id);
            const hookDef = HOOK_ANGLES.find((h) => h.value === angle.hook_angle);
            const statusDef = ANGLE_STATUSES.find((s) => s.value === angle.status);
            const metrics = (angle.metrics_cached as Record<string, number | undefined> | null) || {};

            return (
              <div
                key={angle.id}
                className={`relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:shadow-sm ${
                  angle.status === "winner"
                    ? "border-emerald-500/60 bg-gradient-to-b from-emerald-500/5 via-card to-card ring-1 ring-emerald-500/20"
                    : "hover:border-orange-500/40"
                }`}
              >
                <div className="space-y-3">
                  {/* Topo do Card: Campanha, Tipo de Gancho e Status */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${hookDef?.badge ?? "bg-muted"}`}>
                        {hookDef?.label ?? angle.hook_angle}
                      </span>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${statusDef?.badge ?? "bg-muted"}`}>
                        {statusDef?.label ?? angle.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground truncate">
                      Campanha: <strong>{camp?.name ?? "Geral"}</strong>
                    </p>
                  </div>

                  {/* Título & Avatar */}
                  <div>
                    <h3
                      onClick={() => {
                        setEditingAngle(angle);
                        setDialogOpen(true);
                      }}
                      className="font-semibold text-base leading-snug cursor-pointer hover:text-orange-600 line-clamp-2"
                    >
                      {angle.title}
                    </h3>
                    {angle.target_avatar && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <span>👤 Avatar:</span>
                        <span className="italic truncate">{angle.target_avatar}</span>
                      </p>
                    )}
                  </div>

                  {/* Headline do Anúncio */}
                  {angle.headline && (
                    <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                          Headline / Gancho Scroll
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(angle.headline!, `head_${angle.id}`)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Copiar Headline"
                        >
                          {copiedId === `head_${angle.id}` ? (
                            <CheckIcon className="size-3 text-emerald-500" />
                          ) : (
                            <CopyIcon className="size-3" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs font-semibold leading-relaxed text-foreground">
                        &ldquo;{angle.headline}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Copy do Anúncio (Preview) */}
                  {angle.body_copy && (
                    <div className="rounded-md bg-muted/40 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold uppercase">
                        <span>Texto do Anúncio (Copy)</span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(angle.body_copy!, `copy_${angle.id}`)}
                          className="hover:text-foreground"
                          title="Copiar Copy"
                        >
                          {copiedId === `copy_${angle.id}` ? (
                            <CheckIcon className="size-3 text-emerald-500" />
                          ) : (
                            <CopyIcon className="size-3" />
                          )}
                        </button>
                      </div>
                      <p className="line-clamp-3 text-foreground/80 font-mono text-[11px] whitespace-pre-line">
                        {angle.body_copy}
                      </p>
                    </div>
                  )}

                  {/* CTA e Asset */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                      CTA: <strong>{angle.call_to_action || "WhatsApp"}</strong>
                    </span>
                    {angle.asset_url && (
                      <a
                        href={angle.asset_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 shrink-0"
                      >
                        <ExternalLinkIcon className="size-3" />
                        Ver Mídia
                      </a>
                    )}
                  </div>

                  {/* Métricas do Ângulo (se existirem) */}
                  {metrics.spend_cents ? (
                    <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-muted/20 p-2 text-center text-[10px]">
                      <div>
                        <span className="text-muted-foreground block">Gasto</span>
                        <span className="font-semibold">{formatCentsToBrl(metrics.spend_cents)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">CTR</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {formatPercent(metrics.ctr)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Leads Zap</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {metrics.leads ?? 0}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Ações do Rodapé */}
                <div className="flex items-center justify-between pt-3 mt-3 border-t text-xs">
                  <Button
                    type="button"
                    variant={angle.status === "winner" ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleMarkAsWinner(angle)}
                    className={`h-7 text-xs gap-1 ${
                      angle.status === "winner"
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold border-emerald-500/30"
                        : "hover:text-emerald-600"
                    }`}
                  >
                    <TrophyIcon className="size-3.5" />
                    {angle.status === "winner" ? "Campeão 🏆" : "Tornar Winner"}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingAngle(angle);
                        setDialogOpen(true);
                      }}
                      className="size-7 p-0"
                    >
                      <FileEditIcon className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(angle.id)}
                      className="size-7 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação / Edição de Ângulo */}
      <AngleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        campaigns={campaigns}
        defaultCampaignId={activeCampaignFilter === "all" ? undefined : activeCampaignFilter}
        initialData={editingAngle}
        onSuccess={handleSaved}
      />
    </div>
  );
}
