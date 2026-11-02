"use client";

import { useState } from "react";
import { MegaphoneIcon, CalendarIcon, DollarSignIcon, UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCampaign, updateCampaign, type CampaignInput } from "@/lib/actions/marketing-campaigns";
import { CAMPAIGN_OBJECTIVES, CAMPAIGN_STATUSES, parseBrlToCents, type CampaignStatus } from "../meta";
import { todayIso } from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";

type Campaign = Tables<"marketing_campaigns">;

interface CampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  initialData?: Campaign | null;
  onSuccess: (saved: Campaign) => void;
}

export function CampaignDialog({
  open,
  onOpenChange,
  folderId,
  initialData,
  onSuccess,
}: CampaignDialogProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [objective, setObjective] = useState(initialData?.objective ?? "whatsapp_leads");
  const [status, setStatus] = useState<CampaignStatus>(
    (initialData?.status as CampaignStatus) ?? "draft"
  );
  const [startDate, setStartDate] = useState(initialData?.start_date ?? todayIso());
  const [endDate, setEndDate] = useState(initialData?.end_date ?? "");
  const [dailyBudgetStr, setDailyBudgetStr] = useState(
    initialData?.budget_daily_cents ? (initialData.budget_daily_cents / 100).toFixed(2).replace(".", ",") : "30,00"
  );
  const [totalBudgetStr, setTotalBudgetStr] = useState(
    initialData?.budget_total_cents ? (initialData.budget_total_cents / 100).toFixed(2).replace(".", ",") : "900,00"
  );
  const [targetAudience, setTargetAudience] = useState(
    initialData?.target_audience ?? "Cuiabá e Várzea Grande (raio 25km), 22-55 anos, profissionais liberais e estudantes"
  );
  const [metaCampaignId, setMetaCampaignId] = useState(initialData?.meta_campaign_id ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da campanha.");
      return;
    }
    if (!startDate) {
      toast.error("Informe a data de início.");
      return;
    }

    const budgetDailyCents = parseBrlToCents(dailyBudgetStr);
    const budgetTotalCents = parseBrlToCents(totalBudgetStr);

    setSaving(true);
    try {
      const payload: CampaignInput = {
        name: name.trim(),
        objective,
        status,
        start_date: startDate,
        end_date: endDate.trim() ? endDate.trim() : null,
        budget_daily_cents: budgetDailyCents,
        budget_total_cents: budgetTotalCents,
        target_audience: targetAudience.trim() || null,
        meta_campaign_id: metaCampaignId.trim() || null,
        notes: notes.trim() || null,
        folder_id: folderId,
      };

      if (initialData?.id) {
        const res = await updateCampaign(initialData.id, payload);
        if (res.ok) {
          toast.success("Campanha atualizada com sucesso!");
          onSuccess({
            ...initialData,
            ...payload,
            updated_at: new Date().toISOString(),
          } as Campaign);
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createCampaign(payload);
        if (res.ok) {
          toast.success("Campanha criada com sucesso!");
          onSuccess({
            id: res.data.id,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
            user_id: "",
          } as Campaign);
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      }
    } catch {
      toast.error("Erro ao salvar campanha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold text-xs uppercase tracking-wider">
            <MegaphoneIcon className="size-4" />
            Meta Ads • Trust Care
          </div>
          <DialogTitle className="text-xl">
            {initialData ? "Editar Campanha" : "Nova Campanha de Anúncios"}
          </DialogTitle>
          <DialogDescription>
            Configure datas, objetivos estratégicos e limites de orçamento em Cuiabá (fuso UTC-4).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nome da Campanha */}
          <div className="space-y-1.5">
            <Label htmlFor="camp-name">Nome da Campanha</Label>
            <Input
              id="camp-name"
              placeholder="Ex: [Meta Ads] Upgrade Turbo SSD - Fim de Ano"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Objetivo e Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="camp-objective">Objetivo Comercial</Label>
              <Select value={objective} onValueChange={setObjective}>
                <SelectTrigger id="camp-objective">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_OBJECTIVES.map((obj) => (
                    <SelectItem key={obj.value} value={obj.value}>
                      {obj.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="camp-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
                <SelectTrigger id="camp-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPAIGN_STATUSES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Orçamento Diário e Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-1.5">
              <Label htmlFor="daily-budget" className="flex items-center gap-1.5 text-xs font-semibold">
                <DollarSignIcon className="size-3.5 text-emerald-500" />
                Orçamento Diário (R$)
              </Label>
              <Input
                id="daily-budget"
                placeholder="30,00"
                value={dailyBudgetStr}
                onChange={(e) => setDailyBudgetStr(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">Ex: R$ 30,00/dia</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="total-budget" className="flex items-center gap-1.5 text-xs font-semibold">
                <DollarSignIcon className="size-3.5 text-emerald-500" />
                Orçamento Total Previsto (R$)
              </Label>
              <Input
                id="total-budget"
                placeholder="900,00"
                value={totalBudgetStr}
                onChange={(e) => setTotalBudgetStr(e.target.value)}
              />
              <span className="text-[10px] text-muted-foreground">Ex: R$ 900,00 total</span>
            </div>
          </div>

          {/* Datas (Início e Término) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5 text-muted-foreground" />
                Data de Início
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="flex items-center gap-1.5 text-xs">
                <CalendarIcon className="size-3.5 text-muted-foreground" />
                Data de Término (Opcional)
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Público-Alvo */}
          <div className="space-y-1.5">
            <Label htmlFor="target-audience" className="flex items-center gap-1.5 text-xs">
              <UsersIcon className="size-3.5 text-muted-foreground" />
              Público-Alvo / Segmentação Local
            </Label>
            <Input
              id="target-audience"
              placeholder="Ex: Cuiabá e VG, 25-50 anos, interesse em tecnologia e pequenos negócios"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
            />
          </div>

          {/* Meta Campaign ID (opcional para sincronização) */}
          <div className="space-y-1.5">
            <Label htmlFor="meta-camp-id" className="text-xs text-muted-foreground">
              ID no Gerenciador Meta Ads (Opcional)
            </Label>
            <Input
              id="meta-camp-id"
              placeholder="Ex: 1202094892401829"
              value={metaCampaignId}
              onChange={(e) => setMetaCampaignId(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="camp-notes" className="text-xs text-muted-foreground">
              Anotações Estratégicas
            </Label>
            <Textarea
              id="camp-notes"
              rows={2}
              placeholder="Hipóteses a validar, links de criativos no Drive, orientações de atendimento no WhatsApp..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? "Salvando..." : "Salvar Campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
