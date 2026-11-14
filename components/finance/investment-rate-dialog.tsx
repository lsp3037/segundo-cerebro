"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveInvestmentRate } from "@/lib/actions/finance-investments";
import type { IsoDate } from "@/lib/dates";
import type { InvestmentRateInput, InvestmentView } from "@/lib/finance/investments-data";
import { formatCentsToBrl } from "@/lib/money";
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
import { estimateDailyYield, RateFields, useRateFields } from "./investment-rate-fields";

interface InvestmentRateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentView;
  // CDI diário em % (0.050788 = 0,050788% ao dia), para a prévia do rendimento.
  cdiDailyPercent: number | null;
  today: IsoDate;
}

// "Mudar taxa": nova taxa a partir de um dia. O formulário é montado a cada abertura,
// então os campos sempre começam com a taxa vigente.
export function InvestmentRateDialog({ open, onOpenChange, investment, cdiDailyPercent, today }: InvestmentRateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">Mudar taxa do {investment.name}</DialogTitle>
          <DialogDescription className="text-xs">
            A nova taxa vale desse dia em diante. O que rendeu antes não muda.
          </DialogDescription>
        </DialogHeader>
        <RateForm
          investment={investment}
          cdiDailyPercent={cdiDailyPercent}
          today={today}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function RateForm({
  investment,
  cdiDailyPercent,
  today,
  onDone,
}: {
  investment: InvestmentView;
  cdiDailyPercent: number | null;
  today: IsoDate;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState<IsoDate>(today);
  const rateFields = useRateFields(investment.summary.currentRate);
  const { rate } = rateFields;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from) {
      toast.error("Escolha a partir de que dia vale a nova taxa.");
      return;
    }
    if (!rate.ok) {
      toast.error(rate.error);
      return;
    }
    startTransition(async () => {
      const res = await saveInvestmentRate({ investmentId: investment.id, from, rate: rate.value });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Taxa atualizada.");
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="rate-from" className="text-xs">A partir de que dia?</Label>
        <Input
          id="rate-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="mt-1 text-sm"
          required
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Pode ser um dia que já passou ou um dia que ainda vai chegar.
        </p>
      </div>

      <RateFields values={rateFields.values} onChange={rateFields.update} />

      <p aria-live="polite" className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {ratePreview(investment.summary.valueCents, rate.ok ? rate.value : null, cdiDailyPercent)}
      </p>

      <DialogFooter className="pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ratePreview(valueCents: number, rate: InvestmentRateInput | null, cdiDailyPercent: number | null): string {
  if (!rate) return "Confira a taxa para ver quanto rende por dia útil.";
  if (valueCents <= 0) return "Hoje não há valor guardado, então ainda não rende.";
  const daily = estimateDailyYield(valueCents, rate, cdiDailyPercent);
  if (daily === null) return "A prévia aparece quando o CDI do Banco Central estiver disponível.";
  return `Com o valor de hoje, rende cerca de ${formatCentsToBrl(Math.round(daily))} por dia útil.`;
}
