"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveInvestmentMovement } from "@/lib/actions/finance-investments";
import type { IsoDate } from "@/lib/dates";
import type { InvestmentMovementView, InvestmentView } from "@/lib/finance/investments-data";
import { centsToInput, inputToCents } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type MovementKindInput = "deposit" | "withdrawal";

// O que o diálogo vai registrar: um "Guardei"/"Resgatei" novo, ou a edição de um que já existe.
export type MovementDialogTarget = {
  investment: InvestmentView;
  kind: MovementKindInput;
  movement: InvestmentMovementView | null;
};

const COPY: Record<
  MovementKindInput,
  { title: (name: string) => string; editTitle: (name: string) => string; amountLabel: string; help: string; created: string; updated: string }
> = {
  deposit: {
    title: (name) => `Guardei no ${name}`,
    editTitle: (name) => `Editar o que guardou no ${name}`,
    amountLabel: "Quanto você guardou?",
    help: "Começa a render no próximo dia útil.",
    created: "Aporte registrado.",
    updated: "Aporte atualizado.",
  },
  withdrawal: {
    title: (name) => `Resgatei do ${name}`,
    editTitle: (name) => `Editar o resgate do ${name}`,
    amountLabel: "Quanto você resgatou?",
    help: "Deixa de render a partir do próximo dia útil.",
    created: "Resgate registrado.",
    updated: "Resgate atualizado.",
  },
};

interface InvestmentMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: MovementDialogTarget | null;
  today: IsoDate;
}

// O conteúdo do Dialog sai da tela ao fechar, então o formulário nasce de novo a cada abertura.
export function InvestmentMovementDialog({ open, onOpenChange, target, today }: InvestmentMovementDialogProps) {
  if (!target) return null;
  const copy = COPY[target.kind];
  const name = target.investment.name;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">{target.movement ? copy.editTitle(name) : copy.title(name)}</DialogTitle>
          <DialogDescription className="text-xs">{copy.help}</DialogDescription>
        </DialogHeader>
        <MovementForm target={target} today={today} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function MovementForm({ target, today, onDone }: { target: MovementDialogTarget; today: IsoDate; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const { investment, kind, movement } = target;
  const copy = COPY[kind];

  const [amountStr, setAmountStr] = useState(movement ? centsToInput(movement.amountCents) : "");
  const [date, setDate] = useState<IsoDate>(movement?.date ?? today);
  const [note, setNote] = useState(movement?.note ?? "");

  // Ao editar um resgate, o valor dele volta a contar como disponível.
  const availableCents = investment.summary.valueCents + (movement && kind === "withdrawal" ? movement.amountCents : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = inputToCents(amountStr);
    if (amountCents <= 0) {
      toast.error("Informe o valor (maior que R$ 0,00).");
      return;
    }
    if (!date || date > today) {
      toast.error("Escolha um dia até hoje.");
      return;
    }
    startTransition(async () => {
      const res = await saveInvestmentMovement({
        id: movement?.id,
        investmentId: investment.id,
        kind,
        amountCents,
        date,
        note: note.trim() || null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(movement ? copy.updated : copy.created);
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="flex min-h-5 flex-wrap items-center justify-between gap-x-2">
            <Label htmlFor="movement-amount" className="text-xs">{copy.amountLabel}</Label>
            {kind === "withdrawal" && availableCents > 0 && (
              <button
                type="button"
                onClick={() => setAmountStr(centsToInput(availableCents))}
                className="rounded-sm text-xs text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Resgatar tudo
              </button>
            )}
          </div>
          <Input
            id="movement-amount"
            inputMode="decimal"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="R$ 0,00"
            className="mt-1 font-mono text-sm"
            autoFocus
            required
          />
        </div>
        <div>
          <Label htmlFor="movement-date" className="min-h-5 text-xs">Em que dia?</Label>
          <Input
            id="movement-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 text-sm"
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="movement-note" className="text-xs">Observação</Label>
        <Textarea
          id="movement-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Opcional"
          maxLength={500}
          className="mt-1 min-h-16 text-sm"
        />
      </div>

      <DialogFooter className="pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
