"use client";

import { PlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type AgentSuggestionView, getAgentSuggestions } from "@/lib/actions/content";
import { CONTENT_FORMATS, labelOf } from "./meta";

// Sugestões vindas do Agente de Marketing; "Adicionar" vira uma ideia de conteúdo.
export function AgentSuggestionsDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (s: AgentSuggestionView) => Promise<boolean>;
}) {
  const [items, setItems] = useState<AgentSuggestionView[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAgentSuggestions().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        toast.error(result.error);
        onOpenChange(false);
        return;
      }
      setItems(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sugestões do Agente de Marketing</DialogTitle>
          <DialogDescription>
            {items?.[0]?.test
              ? "Versão de teste: são exemplos fixos. A ligação real com o Agente chega na Fase 6."
              : "Escolha o que vale virar ideia de conteúdo."}
          </DialogDescription>
        </DialogHeader>

        {!items ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Buscando sugestões…</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {items.map((s) => (
              <li key={s.ref} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.notes}</p>
                  <p className="text-xs text-muted-foreground">
                    {[labelOf(CONTENT_FORMATS, s.format), s.pillar].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={added.has(s.ref)}
                  onClick={async () => {
                    if (await onAdd(s)) setAdded((prev) => new Set(prev).add(s.ref));
                  }}
                >
                  <PlusIcon />
                  {added.has(s.ref) ? "Adicionada" : "Adicionar"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
