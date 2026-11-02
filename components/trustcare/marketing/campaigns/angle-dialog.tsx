"use client";

import { useState } from "react";
import { TargetIcon, SparklesIcon, FileTextIcon, LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createAngle, updateAngle, suggestHooksWithAi, type AngleInput } from "@/lib/actions/marketing-campaigns";
import { HOOK_ANGLES, ANGLE_STATUSES, CREATIVE_FORMATS, type AngleStatus } from "../meta";
import type { Tables } from "@/lib/supabase/database.types";

type Campaign = Tables<"marketing_campaigns">;
type Angle = Tables<"campaign_angles">;

interface AngleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaigns: Campaign[];
  defaultCampaignId?: string;
  initialData?: Angle | null;
  onSuccess: (saved: Angle) => void;
}

export function AngleDialog({
  open,
  onOpenChange,
  campaigns,
  defaultCampaignId,
  initialData,
  onSuccess,
}: AngleDialogProps) {
  const [campaignId, setCampaignId] = useState(
    initialData?.campaign_id ?? defaultCampaignId ?? campaigns[0]?.id ?? ""
  );
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [targetAvatar, setTargetAvatar] = useState(initialData?.target_avatar ?? "");
  const [hookAngle, setHookAngle] = useState(initialData?.hook_angle ?? "dor_urgencia");
  const [headline, setHeadline] = useState(initialData?.headline ?? "");
  const [bodyCopy, setBodyCopy] = useState(initialData?.body_copy ?? "");
  const [cta, setCta] = useState(initialData?.call_to_action ?? "Fale com o especialista no WhatsApp");
  const [creativeFormat, setCreativeFormat] = useState(initialData?.creative_format ?? "video_reel");
  const [assetUrl, setAssetUrl] = useState(initialData?.asset_url ?? "");
  const [status, setStatus] = useState<AngleStatus>(
    (initialData?.status as AngleStatus) ?? "testing"
  );
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCampaign = campaigns.find((c) => c.id === campaignId);

  const handleSuggestAi = async () => {
    setLoadingAi(true);
    toast.info("A IA está desenhando ganchos persuasivos para este ângulo...");
    try {
      const res = await suggestHooksWithAi({
        campaignName: selectedCampaign?.name || "Upgrade de Computadores",
        targetAvatar: targetAvatar.trim() || undefined,
        hookAngle,
      });

      if (res.ok) {
        setHeadline(res.data.headline);
        setBodyCopy(res.data.body_copy);
        setCta(res.data.call_to_action);
        if (res.data.target_avatar && !targetAvatar) {
          setTargetAvatar(res.data.target_avatar);
        }
        if (!title.trim()) {
          const angleLabel = HOOK_ANGLES.find((h) => h.value === hookAngle)?.label ?? "Ângulo";
          setTitle(`${angleLabel}: ${res.data.headline.slice(0, 45)}...`);
        }
        toast.success("Headline e copy gerados com sucesso!");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Falha ao consultar IA.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSave = async () => {
    if (!campaignId) {
      toast.error("Selecione a campanha do anúncio.");
      return;
    }
    if (!title.trim()) {
      toast.error("Informe um título descritivo para o ângulo.");
      return;
    }

    setSaving(true);
    try {
      const payload: AngleInput = {
        campaign_id: campaignId,
        title: title.trim(),
        target_avatar: targetAvatar.trim() || null,
        hook_angle: hookAngle,
        headline: headline.trim() || null,
        body_copy: bodyCopy.trim() || null,
        call_to_action: cta.trim() || null,
        creative_format: creativeFormat,
        asset_url: assetUrl.trim() || null,
        status,
      };

      if (initialData?.id) {
        const res = await updateAngle(initialData.id, payload);
        if (res.ok) {
          toast.success("Ângulo atualizado!");
          onSuccess({
            ...initialData,
            ...payload,
            updated_at: new Date().toISOString(),
          } as Angle);
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createAngle(payload);
        if (res.ok) {
          toast.success("Ângulo cadastrado!");
          onSuccess({
            id: res.data.id,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
            meta_ad_id: null,
            metrics_cached: {},
            user_id: "",
          } as Angle);
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      }
    } catch {
      toast.error("Erro ao salvar ângulo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold text-xs uppercase tracking-wider">
            <TargetIcon className="size-4" />
            Matriz de Ângulos de Anúncios
          </div>
          <DialogTitle className="text-xl">
            {initialData ? "Editar Ângulo de Anúncio" : "Novo Ângulo para Teste"}
          </DialogTitle>
          <DialogDescription>
            Documente a dor, a promessa, o avatar e a copy para testar contra outros ângulos da campanha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Sugestão de Gancho com IA */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent">
            <div>
              <p className="text-sm font-medium">Sugerir ganchos e headlines magnéticas</p>
              <p className="text-xs text-muted-foreground">A IA gera o texto inicial adaptado ao mercado de Cuiabá.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingAi}
              onClick={handleSuggestAi}
              className="gap-1.5 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
            >
              <SparklesIcon className="size-3.5" />
              {loadingAi ? "Sugerindo..." : "Sugerir com IA"}
            </Button>
          </div>

          {/* Campanha Vinculada */}
          <div className="space-y-1.5">
            <Label htmlFor="angle-campaign">Campanha Vinculada</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger id="angle-campaign">
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Título do Ângulo */}
          <div className="space-y-1.5">
            <Label htmlFor="angle-title">Nome / Título do Teste</Label>
            <Input
              id="angle-title"
              placeholder="Ex: Dor: 'PC travando em horário de pico no escritório'"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tipo de Gancho */}
            <div className="space-y-1.5">
              <Label htmlFor="hook-angle">Tipo de Gancho Estratégico</Label>
              <Select value={hookAngle} onValueChange={setHookAngle}>
                <SelectTrigger id="hook-angle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOOK_ANGLES.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status do Teste */}
            <div className="space-y-1.5">
              <Label htmlFor="angle-status">Status do Teste</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as AngleStatus)}>
                <SelectTrigger id="angle-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANGLE_STATUSES.map((st) => (
                    <SelectItem key={st.value} value={st.value}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Avatar Específico */}
          <div className="space-y-1.5">
            <Label htmlFor="target-avatar">Avatar / Cliente Ideal Deste Ângulo</Label>
            <Input
              id="target-avatar"
              placeholder="Ex: Advogados, contadores e engenheiros em Cuiabá que não podem parar"
              value={targetAvatar}
              onChange={(e) => setTargetAvatar(e.target.value)}
            />
          </div>

          {/* Headline */}
          <div className="space-y-1.5">
            <Label htmlFor="angle-headline" className="font-semibold text-orange-600 dark:text-orange-400">
              Headline do Anúncio (Gancho de Parar o Scroll)
            </Label>
            <Input
              id="angle-headline"
              placeholder="Ex: Seu notebook demora mais de 3 minutos para ligar todo santo dia?"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
          </div>

          {/* Body Copy */}
          <div className="space-y-1.5">
            <Label htmlFor="angle-copy" className="flex items-center gap-1.5">
              <FileTextIcon className="size-3.5 text-muted-foreground" />
              Texto / Roteiro do Anúncio (Copy)
            </Label>
            <Textarea
              id="angle-copy"
              rows={3}
              placeholder="Copy completa do criativo ou roteiro do anúncio em vídeo..."
              value={bodyCopy}
              onChange={(e) => setBodyCopy(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* CTA */}
            <div className="space-y-1.5">
              <Label htmlFor="angle-cta">Chamada para Ação (CTA)</Label>
              <Input
                id="angle-cta"
                placeholder="Ex: Envie uma mensagem e receba seu orçamento em 15 min"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
              />
            </div>

            {/* Formato Criativo */}
            <div className="space-y-1.5">
              <Label htmlFor="creative-format">Formato Visual</Label>
              <Select value={creativeFormat} onValueChange={setCreativeFormat}>
                <SelectTrigger id="creative-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_FORMATS.map((cf) => (
                    <SelectItem key={cf.value} value={cf.value}>
                      {cf.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Link da Arte / Vídeo */}
          <div className="space-y-1.5">
            <Label htmlFor="asset-url" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LinkIcon className="size-3.5" />
              Link do Arquivo Final (Google Drive / Canva / Vídeo)
            </Label>
            <Input
              id="asset-url"
              placeholder="https://drive.google.com/..."
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
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
            {saving ? "Salvando..." : "Salvar Ângulo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
