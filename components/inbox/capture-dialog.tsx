"use client";

import { InboxIcon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { captureInbox } from "@/lib/actions/inbox";

// Captura rápida (Alt+N ou botão "Capturar"): joga qualquer coisa na Caixa de Entrada.
export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!text.trim() || pending) return;
    startTransition(async () => {
      const result = await captureInbox(text);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText("");
      onOpenChange(false);
      toast.success("Guardado na Caixa de Entrada.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <InboxIcon className="size-4" />
            Capturar
          </DialogTitle>
          <DialogDescription>Ideia, tarefa, link ou anotação. Você organiza depois.</DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          rows={4}
          value={text}
          maxLength={10_000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="O que está na sua cabeça?"
          aria-label="Texto para a Caixa de Entrada"
        />
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            <Kbd>Enter</Kbd> guarda · <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> quebra linha
          </p>
          <Button onClick={submit} disabled={pending || !text.trim()}>
            {pending && <Loader2Icon className="animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
