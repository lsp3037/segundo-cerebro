"use client";

import { useState } from "react";
import {
  VideoIcon,
  LayersIcon,
  GalleryHorizontalIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  FileEditIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTENT_PLANNER_FORMATS, type ReelScriptData, type StorySequenceData, type CarouselScriptData } from "../meta";
import { ReelScriptSheet } from "./reel-script-sheet";
import { StorySequenceSheet } from "./story-sequence-sheet";
import { CarouselBuilderSheet } from "./carousel-builder-sheet";
import { deleteContentScript } from "@/lib/actions/marketing-content";
import type { Tables } from "@/lib/supabase/database.types";

type Idea = Tables<"content_ideas">;

interface ContentPlannerBoardProps {
  initialScripts: Idea[];
  folderId?: string;
}

export function ContentPlannerBoard({
  initialScripts,
  folderId,
}: ContentPlannerBoardProps) {
  const [scripts, setScripts] = useState<Idea[]>(initialScripts);
  const [formatFilter, setFormatFilter] = useState<string>("all");
  const [reelSheetOpen, setReelSheetOpen] = useState(false);
  const [storySheetOpen, setStorySheetOpen] = useState(false);
  const [carouselSheetOpen, setCarouselSheetOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Idea | null>(null);

  const filtered = scripts.filter((s) => {
    if (formatFilter === "all") return true;
    return s.format === formatFilter;
  });

  const handleOpenEdit = (script: Idea) => {
    setEditingScript(script);
    if (script.format === "reel") setReelSheetOpen(true);
    else if (script.format === "story") setStorySheetOpen(true);
    else if (script.format === "carousel") setCarouselSheetOpen(true);
  };

  const handleDelete = async (scriptId: string) => {
    const res = await deleteContentScript(scriptId);
    if (res.ok) {
      setScripts((prev) => prev.filter((s) => s.id !== scriptId));
      toast.success("Roteiro excluído.");
    } else {
      toast.error(res.error);
    }
  };

  const handleScriptSaved = (saved: Idea) => {
    setScripts((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
  };

  const getFormatBadge = (format: string | null) => {
    switch (format) {
      case "reel":
        return (
          <span className="flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <VideoIcon className="size-3" /> Reel 9:16
          </span>
        );
      case "story":
        return (
          <span className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <LayersIcon className="size-3" /> Stories
          </span>
        );
      case "carousel":
        return (
          <span className="flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <GalleryHorizontalIcon className="size-3" /> Carrossel
          </span>
        );
      default:
        return (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Post
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Aprovado</Badge>;
      case "developing":
        return <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400">Em Roteiro</Badge>;
      case "discarded":
        return <Badge variant="secondary" className="text-zinc-500">Descartado</Badge>;
      default:
        return <Badge variant="secondary">Ideia</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de controle: Filtros por formato e Botões de criação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b">
        {/* Filtros em pílulas */}
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup">
          {CONTENT_PLANNER_FORMATS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFormatFilter(f.value)}
              className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                formatFilter === f.value
                  ? "border-orange-500/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-2xs"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.value === "reel" && <VideoIcon className="size-3" />}
              {f.value === "story" && <LayersIcon className="size-3" />}
              {f.value === "carousel" && <GalleryHorizontalIcon className="size-3" />}
              {f.label}
            </button>
          ))}
        </div>

        {/* Menu Criar Novo Roteiro */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5">
                <PlusIcon className="size-4" />
                Novo Roteiro
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  setEditingScript(null);
                  setReelSheetOpen(true);
                }}
                className="gap-2"
              >
                <VideoIcon className="size-4 text-purple-500" />
                <span>Roteiro de Reel</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingScript(null);
                  setStorySheetOpen(true);
                }}
                className="gap-2"
              >
                <LayersIcon className="size-4 text-amber-500" />
                <span>Sequência de Stories</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEditingScript(null);
                  setCarouselSheetOpen(true);
                }}
                className="gap-2"
              >
                <GalleryHorizontalIcon className="size-4 text-blue-500" />
                <span>Carrossel Slide a Slide</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid de Roteiros */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 mb-3">
            <SparklesIcon className="size-6" />
          </div>
          <h3 className="font-semibold text-base">Nenhum roteiro neste formato ainda</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-4">
            Crie novos roteiros persuasivos para Reels, sequências diárias de Stories ou carrosséis com auxílio de IA.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingScript(null);
                setReelSheetOpen(true);
              }}
              className="gap-1.5"
            >
              <VideoIcon className="size-3.5 text-purple-500" />
              Criar Reel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingScript(null);
                setStorySheetOpen(true);
              }}
              className="gap-1.5"
            >
              <LayersIcon className="size-3.5 text-amber-500" />
              Criar Stories
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingScript(null);
                setCarouselSheetOpen(true);
              }}
              className="gap-1.5"
            >
              <GalleryHorizontalIcon className="size-3.5 text-blue-500" />
              Criar Carrossel
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((script) => {
            const reelData = script.format === "reel" ? (script.script_data as unknown as ReelScriptData | null) : null;
            const storyData = script.format === "story" ? (script.script_data as unknown as StorySequenceData | null) : null;
            const carouselData = script.format === "carousel" ? (script.script_data as unknown as CarouselScriptData | null) : null;

            return (
              <div
                key={script.id}
                className="group flex flex-col justify-between rounded-xl border bg-card p-4 transition-all hover:border-orange-500/40 hover:shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    {getFormatBadge(script.format)}
                    {getStatusBadge(script.status)}
                  </div>

                  <div>
                    <h3
                      onClick={() => handleOpenEdit(script)}
                      className="font-semibold text-base leading-snug cursor-pointer group-hover:text-orange-600 dark:group-hover:text-orange-400 line-clamp-2"
                    >
                      {script.title}
                    </h3>
                  </div>

                  {/* Resumo do Gancho / Conteúdo */}
                  {reelData?.hook_3s && (
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs space-y-1">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider">
                        Gancho 3s:
                      </span>
                      <p className="line-clamp-2 italic text-foreground/90">
                        &ldquo;{reelData.hook_3s}&rdquo;
                      </p>
                    </div>
                  )}

                  {storyData?.frames && (
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs space-y-1">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider">
                        Estrutura ({storyData.frames.length} quadros):
                      </span>
                      <p className="line-clamp-2 text-foreground/90">
                        {storyData.frames.map((f) => f.goal).join(" → ")}
                      </p>
                    </div>
                  )}

                  {carouselData?.slides && (
                    <div className="rounded-md bg-muted/50 p-2.5 text-xs space-y-1">
                      <span className="font-semibold text-muted-foreground block text-[10px] uppercase tracking-wider">
                        Slides ({carouselData.slides.length}):
                      </span>
                      <p className="line-clamp-2 text-foreground/90">
                        Capa: &ldquo;{carouselData.slides[0]?.headline}&rdquo;
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 mt-2 border-t text-xs text-muted-foreground">
                  <span>Atualizado recentemente</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenEdit(script)}
                      className="h-8 gap-1 text-xs"
                    >
                      <FileEditIcon className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(script.id)}
                      className="size-8 text-muted-foreground hover:text-destructive"
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

      {/* Sheets dos Roteiros */}
      <ReelScriptSheet
        open={reelSheetOpen}
        onOpenChange={setReelSheetOpen}
        folderId={folderId}
        initialData={editingScript}
        onSuccess={handleScriptSaved}
      />

      <StorySequenceSheet
        open={storySheetOpen}
        onOpenChange={setStorySheetOpen}
        folderId={folderId}
        initialData={editingScript}
        onSuccess={handleScriptSaved}
      />

      <CarouselBuilderSheet
        open={carouselSheetOpen}
        onOpenChange={setCarouselSheetOpen}
        folderId={folderId}
        initialData={editingScript}
        onSuccess={handleScriptSaved}
      />
    </div>
  );
}
