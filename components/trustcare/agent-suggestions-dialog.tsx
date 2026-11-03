"use client";

import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClapperboardIcon,
  FlameIcon,
  LaptopIcon,
  LayersIcon,
  PlusIcon,
  RefreshCwIcon,
  SmartphoneIcon,
  SparklesIcon,
  SunMediumIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  type AgentSuggestionView,
  type ContentHypeFocus,
  getAgentSuggestions,
} from "@/lib/actions/content";
import { cn } from "@/lib/utils";
import { CONTENT_FORMATS, labelOf } from "./meta";

const FOCUS_OPTIONS: Array<{
  id: ContentHypeFocus;
  label: string;
  icon: typeof FlameIcon;
}> = [
  { id: "todos", label: "Geral (Hype)", icon: FlameIcon },
  { id: "reels", label: "Reels Virais", icon: ClapperboardIcon },
  { id: "carrosseis", label: "Carrosséis", icon: LayersIcon },
  { id: "stories", label: "Stories", icon: SmartphoneIcon },
  { id: "calor_cuiaba", label: "Calor Cuiabá", icon: SunMediumIcon },
  { id: "venda_notebooks", label: "Upgrades & Venda", icon: LaptopIcon },
];

export function AgentSuggestionsDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (s: AgentSuggestionView) => Promise<boolean>;
}) {
  const [cache, setCache] = useState<Partial<Record<ContentHypeFocus, AgentSuggestionView[]>>>({});
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<ContentHypeFocus>("todos");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingRef, setAddingRef] = useState<string | null>(null);

  const fetchFocus = useCallback(
    async (selectedFocus: ContentHypeFocus, force = false) => {
      setLoading(true);
      try {
        const result = await getAgentSuggestions({ focus: selectedFocus });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCache((prev) => ({ ...prev, [selectedFocus]: result.data }));
      } catch (err) {
        console.error("fetchFocus error:", err);
        toast.error("Tempo de resposta excedido. Carregando sugestões do radar.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    if (!cache[focus]) {
      fetchFocus(focus);
    }
  }, [open, focus, cache, fetchFocus]);

  const toggleExpand = (ref: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });
  };

  const currentItems = cache[focus];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="space-y-1.5 pb-2 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <SparklesIcon className="size-4" />
              </span>
              <DialogTitle className="text-base font-semibold">
                Radar de Ideias & Hype (Ootto Content Skills)
              </DialogTitle>
            </div>
            <Button
              size="xs"
              variant="outline"
              disabled={loading}
              onClick={() => {
                setCache((prev) => {
                  const next = { ...prev };
                  delete next[focus];
                  return next;
                });
                fetchFocus(focus, true);
              }}
              className="gap-1.5 text-xs h-7 cursor-pointer"
            >
              <RefreshCwIcon className={cn("size-3", loading && "animate-spin")} />
              {loading ? "Gerando..." : "Gerar novas ideias"}
            </Button>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Mapeia o que está funcionando no nicho da Trust Care usando engenharia de ganchos
            virais (0-3s), formatos validados e dores locais de Cuiabá.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros de Foco / Nicho */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 pb-1">
          {FOCUS_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = focus === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setFocus(opt.id);
                  if (!cache[opt.id]) {
                    fetchFocus(opt.id);
                  }
                }}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors cursor-pointer",
                  active
                    ? "border-primary/50 bg-primary/10 text-primary font-medium"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                <Icon className="size-3" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Lista de Ideias */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-2">
          {loading && !currentItems ? (
            <div className="py-12 text-center text-sm text-muted-foreground space-y-2">
              <RefreshCwIcon className="size-6 animate-spin mx-auto text-primary" />
              <p>Buscando formatos e ganchos de {FOCUS_OPTIONS.find((o) => o.id === focus)?.label}...</p>
            </div>
          ) : !currentItems || currentItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma ideia encontrada para esta categoria.
            </p>
          ) : (
            <ul className="space-y-3">
              {currentItems.map((s) => {
                const isAdded = added.has(s.ref);
                const isExpanded = expanded.has(s.ref);
                return (
                  <li
                    key={s.ref}
                    className={cn(
                      "rounded-lg border p-3.5 transition-all space-y-2.5",
                      isAdded
                        ? "border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/10"
                        : "border-border/70 hover:border-border bg-card",
                    )}
                  >
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 uppercase font-semibold">
                            {labelOf(CONTENT_FORMATS, s.format) || "Conteúdo"}
                          </Badge>
                          {s.emotionalAngle && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5 font-normal bg-muted text-muted-foreground"
                            >
                              {s.emotionalAngle}
                            </Badge>
                          )}
                          {s.pillar && (
                            <span className="text-[11px] text-muted-foreground">
                              · {s.pillar}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold leading-snug text-foreground">
                          {s.title}
                        </h4>
                      </div>

                      <Button
                        size="sm"
                        variant={isAdded ? "ghost" : "default"}
                        disabled={isAdded || addingRef === s.ref}
                        onClick={async () => {
                          try {
                            setAddingRef(s.ref);
                            const success = await onAdd(s);
                            if (success) {
                              setAdded((prev) => new Set(prev).add(s.ref));
                            }
                          } catch (err) {
                            toast.error((err as Error).message || "Erro ao adicionar");
                          } finally {
                            setAddingRef(null);
                          }
                        }}
                        className={cn(
                          "shrink-0 h-8 gap-1.5 text-xs font-medium cursor-pointer",
                          isAdded && "text-emerald-500 hover:text-emerald-500",
                        )}
                      >
                        {addingRef === s.ref ? (
                          <>
                            <RefreshCwIcon className="size-3.5 animate-spin" />
                            Adicionando…
                          </>
                        ) : isAdded ? (
                          <>
                            <CheckIcon className="size-3.5" />
                            Adicionada
                          </>
                        ) : (
                          <>
                            <PlusIcon className="size-3.5" />
                            Adicionar
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Capa do Carrossel (Skill carousel-builder) */}
                    {s.format === "carousel" && s.coverHeadline && (
                      <div className="flex items-center gap-2 rounded bg-muted/50 px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground font-medium shrink-0">
                          🖼️ Capa (Slide 1):
                        </span>
                        <code className="text-xs font-semibold text-primary">
                          "{s.coverHeadline}"
                        </code>
                      </div>
                    )}

                    {/* Enquete / Sticker de Stories (Skill story-sequencer) */}
                    {s.format === "story" && s.interactivePoll && (
                      <div className="flex items-center gap-2 rounded bg-muted/50 px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground font-medium shrink-0">
                          📊 Enquete / Sticker:
                        </span>
                        <code className="text-xs font-semibold text-primary">
                          {s.interactivePoll}
                        </code>
                      </div>
                    )}

                    {/* Texto na tela para Reels (Skill viral-hook-writer) */}
                    {s.format !== "carousel" && s.format !== "story" && s.onScreenText && (
                      <div className="flex items-center gap-2 rounded bg-muted/50 px-2.5 py-1 text-xs">
                        <span className="text-muted-foreground font-medium shrink-0">
                          Texto na tela (0-3s):
                        </span>
                        <code className="text-xs font-semibold text-primary">
                          "{s.onScreenText}"
                        </code>
                      </div>
                    )}

                    {/* Toggle de Detalhes / Roteiro */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(s.ref)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUpIcon className="size-3" />
                            Ocultar roteiro
                          </>
                        ) : (
                          <>
                            <ChevronDownIcon className="size-3" />
                            {s.format === "carousel"
                              ? "Ver estrutura slide a slide (carousel-builder) & CTA"
                              : s.format === "story"
                              ? "Ver sequência de 4 quadros (story-sequencer) & CTA"
                              : "Ver roteiro de retenção de bancada & CTA"}
                          </>
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 rounded-md border border-border/50 bg-background/60 p-2.5 text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                          {s.notes}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
