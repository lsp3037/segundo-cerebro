"use client";

import { useState } from "react";
import { SparklesIcon, Trash2Icon, PlusIcon, VideoIcon, MusicIcon, ClockIcon } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveReelScript, generateReelWithAi } from "@/lib/actions/marketing-content";
import type { ReelScriptData } from "../meta";
import type { Tables } from "@/lib/supabase/database.types";

type Idea = Tables<"content_ideas">;

interface ReelScriptSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  initialData?: Idea | null;
  onSuccess: (saved: Idea) => void;
}

export function ReelScriptSheet({
  open,
  onOpenChange,
  folderId,
  initialData,
  onSuccess,
}: ReelScriptSheetProps) {
  const existingScript = (initialData?.script_data as ReelScriptData | null) ?? null;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [hook3s, setHook3s] = useState(existingScript?.hook_3s ?? "");
  const [retentionSteps, setRetentionSteps] = useState<string[]>(
    existingScript?.retention_body?.length ? existingScript.retention_body : [""]
  );
  const [cta, setCta] = useState(existingScript?.cta ?? "");
  const [audio, setAudio] = useState(existingScript?.audio_suggestion ?? "Instrumental dinâmico em alta");
  const [duration, setDuration] = useState(existingScript?.duration_seconds ?? 45);
  const [status, setStatus] = useState<"idea" | "developing" | "approved" | "discarded">(
    (initialData?.status as "idea" | "developing" | "approved" | "discarded") ?? "developing"
  );
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddStep = () => {
    setRetentionSteps((prev) => [...prev, ""]);
  };

  const handleUpdateStep = (index: number, value: string) => {
    setRetentionSteps((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleRemoveStep = (index: number) => {
    setRetentionSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerateAi = async () => {
    const topic = title.trim() || "Upgrade de SSD e limpeza para notebook travando";
    setLoadingAi(true);
    toast.info("A IA está estruturando seu roteiro de Reel...");
    try {
      const res = await generateReelWithAi(topic);
      if (res.ok) {
        setTitle(res.data.title);
        setHook3s(res.data.hook_3s);
        setRetentionSteps(res.data.retention_body);
        setCta(res.data.cta);
        setAudio(res.data.audio_suggestion);
        setDuration(res.data.duration_seconds || 45);
        toast.success("Roteiro de Reel gerado com sucesso!");
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Falha ao gerar com IA.");
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Informe o título do Reel.");
      return;
    }
    if (!hook3s.trim()) {
      toast.error("Preencha o gancho inicial de 3 segundos.");
      return;
    }
    const cleanSteps = retentionSteps.filter((s) => s.trim().length > 0);
    if (cleanSteps.length === 0) {
      toast.error("Adicione ao menos uma etapa no desenvolvimento.");
      return;
    }
    if (!cta.trim()) {
      toast.error("Preencha a chamada para ação (CTA).");
      return;
    }

    setSaving(true);
    try {
      const res = await saveReelScript({
        id: initialData?.id,
        folder_id: folderId,
        title: title.trim(),
        hook_3s: hook3s.trim(),
        retention_body: cleanSteps,
        cta: cta.trim(),
        audio_suggestion: audio.trim(),
        duration_seconds: Number(duration),
        status,
      });

      if (res.ok) {
        toast.success(initialData ? "Roteiro atualizado!" : "Roteiro salvo com sucesso!");
        onSuccess({
          id: res.data.id,
          title,
          format: "reel",
          status,
          folder_id: folderId ?? null,
          campaign_angle_id: initialData?.campaign_angle_id ?? null,
          created_at: initialData?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
          deleted_at: null,
          notes: null,
          pillar_id: null,
          references: [],
          tags: [],
          user_id: "",
          script_data: {
            type: "reel",
            hook_3s: hook3s.trim(),
            retention_body: cleanSteps,
            cta: cta.trim(),
            audio_suggestion: audio.trim(),
            duration_seconds: Number(duration),
          },
        } as unknown as Idea);
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar o roteiro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader className="space-y-1 pb-4 border-b">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <VideoIcon className="size-4 text-orange-500" />
            <span>Roteiro de Reel 9:16</span>
          </div>
          <SheetTitle className="text-xl">
            {initialData ? "Editar Roteiro de Reel" : "Novo Roteiro de Reel"}
          </SheetTitle>
          <SheetDescription>
            Estruture o vídeo para retenção máxima no Instagram: gancho instantâneo, corpo técnico dinâmico e chamada para ação.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {/* Botão IA */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent">
            <div>
              <p className="text-sm font-medium">Bloqueio criativo?</p>
              <p className="text-xs text-muted-foreground">Deixe a IA montar a estrutura completa.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingAi}
              onClick={handleGenerateAi}
              className="gap-1.5 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
            >
              <SparklesIcon className="size-3.5" />
              {loadingAi ? "Gerando..." : "Gerar com IA"}
            </Button>
          </div>

          {/* Título e Status */}
          <div className="space-y-1.5">
            <Label htmlFor="reel-title">Título / Tema do Vídeo</Label>
            <Input
              id="reel-title"
              placeholder="Ex: Como salvar seu notebook travando sem gastar com um novo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reel-status">Status de Produção</Label>
              <Select value={status} onValueChange={(val: "idea" | "developing" | "approved" | "discarded") => setStatus(val)}>
                <SelectTrigger id="reel-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">💡 Ideia</SelectItem>
                  <SelectItem value="developing">📝 Em Roteiro</SelectItem>
                  <SelectItem value="approved">✅ Aprovado p/ Gravar</SelectItem>
                  <SelectItem value="discarded">🗑️ Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reel-duration" className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5 text-muted-foreground" />
                Duração Estimada
              </Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger id="reel-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">⚡ 30 segundos (Ultra rápido)</SelectItem>
                  <SelectItem value="45">⏱️ 45 segundos (Recomendado)</SelectItem>
                  <SelectItem value="60">⏳ 60 segundos (Explicativo)</SelectItem>
                  <SelectItem value="90">📢 90 segundos (Aula/Estudo de caso)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Gancho 3s */}
          <div className="space-y-2 p-3.5 rounded-lg border border-orange-500/30 bg-orange-500/5">
            <div className="flex items-center justify-between">
              <Label htmlFor="hook-3s" className="text-orange-600 dark:text-orange-400 font-semibold flex items-center gap-1.5">
                🎯 Gancho dos Primeiros 3 Segundos
              </Label>
              <span className="text-[11px] text-muted-foreground">Pára o scroll no feed</span>
            </div>
            <Textarea
              id="hook-3s"
              rows={2}
              placeholder="Ex: 'Pare de comprar notebook novo antes de ver o que tinha dentro desse Dell...'"
              value={hook3s}
              onChange={(e) => setHook3s(e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Retenção (Etapas da gravação) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-sm">Passo a Passo de Retenção (Bancada/Gravação)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleAddStep} className="h-7 text-xs gap-1">
                <PlusIcon className="size-3.5" />
                Adicionar Cena
              </Button>
            </div>

            <div className="space-y-2">
              {retentionSteps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground mt-1.5">
                    {idx + 1}
                  </span>
                  <Input
                    placeholder={`Cena ${idx + 1}: ex. Mostre a placa mãe com poeira no microscópio`}
                    value={step}
                    onChange={(e) => handleUpdateStep(idx, e.target.value)}
                  />
                  {retentionSteps.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStep(idx)}
                      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-1.5">
            <Label htmlFor="reel-cta">Chamada para Ação (CTA Final)</Label>
            <Input
              id="reel-cta"
              placeholder="Ex: Comente 'UPGRADE' ou mande uma mensagem no WhatsApp da Trust Care."
              value={cta}
              onChange={(e) => setCta(e.target.value)}
            />
          </div>

          {/* Áudio Sugerido */}
          <div className="space-y-1.5">
            <Label htmlFor="reel-audio" className="flex items-center gap-1.5">
              <MusicIcon className="size-3.5 text-muted-foreground" />
              Sugestão de Áudio / Trilha Sonora
            </Label>
            <Input
              id="reel-audio"
              placeholder="Ex: Áudio 'Phonk Instrumental' em alta ou voz direta com trilha Lo-Fi baixa"
              value={audio}
              onChange={(e) => setAudio(e.target.value)}
            />
          </div>
        </div>

        <SheetFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? "Salvando..." : "Salvar Roteiro"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
