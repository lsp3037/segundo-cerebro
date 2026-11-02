"use client";

import { useState } from "react";
import { SparklesIcon, LayersIcon, PlusIcon, Trash2Icon, MessageSquareIcon } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveStorySequence, generateStorySequenceWithAi } from "@/lib/actions/marketing-content";
import type { StorySequenceData, StoryFrame } from "../meta";
import type { Tables } from "@/lib/supabase/database.types";

type Idea = Tables<"content_ideas">;

interface StorySequenceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  initialData?: Idea | null;
  onSuccess: (saved: Idea) => void;
}

const DEFAULT_FRAMES: StoryFrame[] = [
  { number: 1, goal: "Contexto / Curiosidade", text: "", interactive_element: "Enquete interativa" },
  { number: 2, goal: "Problema na Bancada", text: "", interactive_element: "Foto com seta de destaque" },
  { number: 3, goal: "Solução Técnica", text: "", interactive_element: "Vídeo curto da peça funcionando" },
  { number: 4, goal: "Oferta & CTA", text: "", interactive_element: "Caixinha / Link direto de WhatsApp" },
];

export function StorySequenceSheet({
  open,
  onOpenChange,
  folderId,
  initialData,
  onSuccess,
}: StorySequenceSheetProps) {
  const existingScript = (initialData?.script_data as StorySequenceData | null) ?? null;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [frames, setFrames] = useState<StoryFrame[]>(
    existingScript?.frames?.length ? existingScript.frames : DEFAULT_FRAMES
  );
  const [status, setStatus] = useState<"idea" | "developing" | "approved" | "discarded">(
    (initialData?.status as "idea" | "developing" | "approved" | "discarded") ?? "developing"
  );
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleUpdateFrame = (index: number, patch: Partial<StoryFrame>) => {
    setFrames((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleAddFrame = () => {
    setFrames((prev) => [
      ...prev,
      {
        number: prev.length + 1,
        goal: "Quadro Adicional",
        text: "",
        interactive_element: "Sticker ou Link",
      },
    ]);
  };

  const handleRemoveFrame = (index: number) => {
    setFrames((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((f, i) => ({ ...f, number: i + 1 }))
    );
  };

  const handleGenerateAi = async () => {
    const topic = title.trim() || "Bastidores da bancada: notebook molhado recuperado";
    setLoadingAi(true);
    toast.info("A IA está criando a narrativa dos seus Stories...");
    try {
      const res = await generateStorySequenceWithAi(topic);
      if (res.ok) {
        setTitle(res.data.title);
        setFrames(res.data.frames);
        toast.success("Sequência de Stories gerada com sucesso!");
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
      toast.error("Informe o título da sequência de Stories.");
      return;
    }
    const hasEmptyText = frames.some((f) => !f.text.trim());
    if (hasEmptyText) {
      toast.error("Preencha o texto de todos os quadros da sequência.");
      return;
    }

    setSaving(true);
    try {
      const res = await saveStorySequence({
        id: initialData?.id,
        folder_id: folderId,
        title: title.trim(),
        frames,
        status,
      });

      if (res.ok) {
        toast.success(initialData ? "Sequência atualizada!" : "Sequência salva com sucesso!");
        onSuccess({
          id: res.data.id,
          title,
          format: "story",
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
            type: "story",
            frames,
          },
        } as unknown as Idea);
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar a sequência.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-6">
        <SheetHeader className="space-y-1 pb-4 border-b">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <LayersIcon className="size-4 text-orange-500" />
            <span>Sequência de Stories (4 Atos)</span>
          </div>
          <SheetTitle className="text-xl">
            {initialData ? "Editar Sequência de Stories" : "Nova Sequência de Stories"}
          </SheetTitle>
          <SheetDescription>
            Conduza sua audiência do problema até a conversa no WhatsApp através de uma narrativa lógica e interativa.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 py-5">
          {/* Gerar com IA */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent">
            <div>
              <p className="text-sm font-medium">Narrativa automática com IA</p>
              <p className="text-xs text-muted-foreground">Preencha um tema básico e deixe a IA montar os 4 quadros.</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="story-title">Tema / Título da Sequência</Label>
              <Input
                id="story-title"
                placeholder="Ex: Do diagnóstico à salvação: Dell G15 esquentando a 95°C"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="story-status">Status</Label>
              <Select value={status} onValueChange={(val: "idea" | "developing" | "approved" | "discarded") => setStatus(val)}>
                <SelectTrigger id="story-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">💡 Ideia</SelectItem>
                  <SelectItem value="developing">📝 Em Roteiro</SelectItem>
                  <SelectItem value="approved">✅ Aprovado</SelectItem>
                  <SelectItem value="discarded">🗑️ Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quadros visuais */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-sm">Quadros da Sequência ({frames.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleAddFrame} className="h-7 text-xs gap-1">
                <PlusIcon className="size-3.5" />
                Adicionar Quadro
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {frames.map((frame, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border p-3.5 bg-card hover:border-orange-500/40 transition-colors space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold text-xs">
                        {frame.number}
                      </span>
                      <Input
                        value={frame.goal}
                        onChange={(e) => handleUpdateFrame(idx, { goal: e.target.value })}
                        className="h-7 text-xs font-semibold max-w-[200px]"
                        placeholder="Objetivo do quadro"
                      />
                    </div>
                    {frames.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveFrame(idx)}
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div>
                    <Textarea
                      rows={2}
                      placeholder={`O que falar ou gravar no Story ${frame.number}...`}
                      value={frame.text}
                      onChange={(e) => handleUpdateFrame(idx, { text: e.target.value })}
                      className="text-sm bg-muted/40"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1 text-xs">
                    <MessageSquareIcon className="size-3.5 text-muted-foreground shrink-0" />
                    <Input
                      value={frame.interactive_element}
                      onChange={(e) => handleUpdateFrame(idx, { interactive_element: e.target.value })}
                      placeholder="Elemento Interativo (ex: Enquete, Link do WhatsApp, Caixinha)"
                      className="h-7 text-xs bg-background"
                    />
                  </div>
                </div>
              ))}
            </div>
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
            {saving ? "Salvando..." : "Salvar Sequência"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
