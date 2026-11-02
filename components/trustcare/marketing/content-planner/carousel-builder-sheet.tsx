"use client";

import { useState } from "react";
import { SparklesIcon, GalleryHorizontalIcon, PlusIcon, Trash2Icon, ChevronLeftIcon, ChevronRightIcon, EyeIcon } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { saveCarouselScript, generateCarouselWithAi } from "@/lib/actions/marketing-content";
import type { CarouselScriptData, CarouselSlide } from "../meta";
import type { Tables } from "@/lib/supabase/database.types";

type Idea = Tables<"content_ideas">;

interface CarouselBuilderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId?: string;
  initialData?: Idea | null;
  onSuccess: (saved: Idea) => void;
}

const DEFAULT_SLIDES: CarouselSlide[] = [
  { index: 1, role: "capa", headline: "5 Sinais de que seu notebook vai queimar a qualquer momento", body: "E como resolver antes do prejuízo de R$ 3.000.", visual_cue: "Foto chamativa de tela preta ou fumaça estilizada" },
  { index: 2, role: "conteudo", headline: "1. Cooler barulhento ou rodando no máximo direto", body: "Indica que o dissipador está entupido de poeira e não consegue refrigerar o processador.", visual_cue: "Close no cooler cheio de poeira" },
  { index: 3, role: "conteudo", headline: "2. Travamentos ao abrir mais de 5 abas", body: "Falta de memória RAM e SSD antigo em 100% de uso contínuo.", visual_cue: "Gráfico de desempenho do Windows em vermelho" },
  { index: 4, role: "cta", headline: "Não espere o PC parar de vez!", body: "Traga seu aparelho hoje na Trust Care para um diagnóstico preventivo completo.", visual_cue: "Logo da Trust Care e contato WhatsApp" },
];

export function CarouselBuilderSheet({
  open,
  onOpenChange,
  folderId,
  initialData,
  onSuccess,
}: CarouselBuilderSheetProps) {
  const existingScript = (initialData?.script_data as CarouselScriptData | null) ?? null;

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slides, setSlides] = useState<CarouselSlide[]>(
    existingScript?.slides?.length ? existingScript.slides : DEFAULT_SLIDES
  );
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [status, setStatus] = useState<"idea" | "developing" | "approved" | "discarded">(
    (initialData?.status as "idea" | "developing" | "approved" | "discarded") ?? "developing"
  );
  const [loadingAi, setLoadingAi] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentPreviewSlide = slides[activePreviewIndex] || slides[0];

  const handleUpdateSlide = (index: number, patch: Partial<CarouselSlide>) => {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleAddSlide = () => {
    setSlides((prev) => [
      ...prev,
      {
        index: prev.length + 1,
        role: "conteudo",
        headline: "",
        body: "",
        visual_cue: "Sugestão visual",
      },
    ]);
    setActivePreviewIndex(slides.length);
  };

  const handleRemoveSlide = (index: number) => {
    setSlides((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, index: i + 1 }))
    );
    if (activePreviewIndex >= slides.length - 1) {
      setActivePreviewIndex(Math.max(0, slides.length - 2));
    }
  };

  const handleGenerateAi = async () => {
    const topic = title.trim() || "Como saber se vale a pena fazer upgrade ou comprar novo";
    setLoadingAi(true);
    toast.info("A IA está desenhando os slides do seu carrossel...");
    try {
      const res = await generateCarouselWithAi(topic);
      if (res.ok) {
        setTitle(res.data.title);
        setSlides(res.data.slides);
        setActivePreviewIndex(0);
        toast.success("Carrossel gerado com sucesso!");
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
      toast.error("Informe o título do carrossel.");
      return;
    }
    const hasEmptyHeadline = slides.some((s) => !s.headline.trim());
    if (hasEmptyHeadline) {
      toast.error("Todos os slides precisam de um título/headline.");
      return;
    }

    setSaving(true);
    try {
      const res = await saveCarouselScript({
        id: initialData?.id,
        folder_id: folderId,
        title: title.trim(),
        slides,
        status,
      });

      if (res.ok) {
        toast.success(initialData ? "Carrossel atualizado!" : "Carrossel salvo com sucesso!");
        onSuccess({
          id: res.data.id,
          title,
          format: "carousel",
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
            type: "carousel",
            slides,
          },
        } as unknown as Idea);
        onOpenChange(false);
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Erro ao salvar o carrossel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-6">
        <SheetHeader className="space-y-1 pb-4 border-b">
          <div className="flex items-center gap-2 text-primary font-semibold text-sm">
            <GalleryHorizontalIcon className="size-4 text-orange-500" />
            <span>Construtor de Carrosséis 1:1</span>
          </div>
          <SheetTitle className="text-xl">
            {initialData ? "Editar Carrossel" : "Novo Carrossel Slide a Slide"}
          </SheetTitle>
          <SheetDescription>
            Crie publicações educativas com alta taxa de salvamento e compartilhamento no feed do Instagram.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-5">
          {/* Gerador IA */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-transparent">
            <div>
              <p className="text-sm font-medium">Gerar carrossel educativo com IA</p>
              <p className="text-xs text-muted-foreground">Cria a capa, os pontos de explicação técnica e a CTA final.</p>
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
              <Label htmlFor="carousel-title">Título / Tema</Label>
              <Input
                id="carousel-title"
                placeholder="Ex: Guia definitivo para o notebook não travar no calor de Cuiabá"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="carousel-status">Status</Label>
              <Select value={status} onValueChange={(val: "idea" | "developing" | "approved" | "discarded") => setStatus(val)}>
                <SelectTrigger id="carousel-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">💡 Ideia</SelectItem>
                  <SelectItem value="developing">📝 Em Roteiro</SelectItem>
                  <SelectItem value="approved">✅ Aprovado p/ Design</SelectItem>
                  <SelectItem value="discarded">🗑️ Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pré-visualização do Slide Ativo */}
          {currentPreviewSlide && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <EyeIcon className="size-3.5 text-orange-500" />
                  Pré-visualização do Slide {activePreviewIndex + 1} de {slides.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={activePreviewIndex === 0}
                    onClick={() => setActivePreviewIndex((i) => Math.max(0, i - 1))}
                  >
                    <ChevronLeftIcon className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={activePreviewIndex >= slides.length - 1}
                    onClick={() => setActivePreviewIndex((i) => Math.min(slides.length - 1, i + 1))}
                  >
                    <ChevronRightIcon className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border bg-gradient-to-b from-card to-muted/40 p-5 shadow-xs flex flex-col justify-between aspect-square max-w-sm mx-auto">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[11px] uppercase tracking-wide">
                    {currentPreviewSlide.role === "capa" ? "Capa 1/N" : currentPreviewSlide.role === "cta" ? "CTA Final" : `Slide ${currentPreviewSlide.index}`}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">Trust Care • Cuiabá</span>
                </div>

                <div className="my-auto space-y-2 text-center px-2">
                  <h3 className="font-bold text-lg leading-snug">
                    {currentPreviewSlide.headline || "Título do Slide"}
                  </h3>
                  {currentPreviewSlide.body && (
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {currentPreviewSlide.body}
                    </p>
                  )}
                </div>

                <div className="p-2 rounded-md bg-muted/60 text-[11px] text-muted-foreground text-center italic">
                  🎨 Sugestão Visual: {currentPreviewSlide.visual_cue || "Sem indicação"}
                </div>
              </div>
            </div>
          )}

          {/* Lista de Slides para Edição */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-sm">Editor dos Slides ({slides.length})</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleAddSlide} className="h-7 text-xs gap-1">
                <PlusIcon className="size-3.5" />
                Adicionar Slide
              </Button>
            </div>

            <div className="space-y-3">
              {slides.map((slide, idx) => (
                <div
                  key={idx}
                  onClick={() => setActivePreviewIndex(idx)}
                  className={`rounded-lg border p-4 space-y-3 transition-colors cursor-pointer ${
                    activePreviewIndex === idx
                      ? "border-orange-500 bg-orange-500/5"
                      : "bg-card hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-muted font-bold text-xs">
                        {slide.index}
                      </span>
                      <Select
                        value={slide.role}
                        onValueChange={(val: "capa" | "conteudo" | "cta") => handleUpdateSlide(idx, { role: val })}
                      >
                        <SelectTrigger className="h-7 text-xs w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="capa">Capa (Slide 1)</SelectItem>
                          <SelectItem value="conteudo">Conteúdo</SelectItem>
                          <SelectItem value="cta">CTA Final</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {slides.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSlide(idx);
                        }}
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Input
                      placeholder="Título / Gancho do Slide"
                      value={slide.headline}
                      onChange={(e) => handleUpdateSlide(idx, { headline: e.target.value })}
                      className="font-medium text-sm"
                    />
                    <Textarea
                      rows={2}
                      placeholder="Texto de apoio ou explicação (opcional)..."
                      value={slide.body ?? ""}
                      onChange={(e) => handleUpdateSlide(idx, { body: e.target.value })}
                      className="text-xs"
                    />
                    <Input
                      placeholder="Sugestão visual da arte (ex: Mockup de tela, foto do laboratório)"
                      value={slide.visual_cue}
                      onChange={(e) => handleUpdateSlide(idx, { visual_cue: e.target.value })}
                      className="text-xs text-muted-foreground bg-muted/40"
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
            {saving ? "Salvando..." : "Salvar Carrossel"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
