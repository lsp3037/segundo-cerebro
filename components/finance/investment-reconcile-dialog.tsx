"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteInvestmentMovement, reconcileInvestment } from "@/lib/actions/finance-investments";
import type { InvestmentView } from "@/lib/finance/investments-data";
import { formatCentsToBrl, inputToCents } from "@/lib/money";
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
import { signedBrl } from "./investment-format";
import { toastWithUndo } from "./pay-toggle";

interface InvestmentReconcileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investment: InvestmentView;
}

// "Acertar com o app": o Luan digita o valor que o app do banco mostra e a diferença vira um ajuste.
export function InvestmentReconcileDialog({ open, onOpenChange, investment }: InvestmentReconcileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">Acertar com o app</DialogTitle>
          <DialogDescription className="text-xs">
            Abra o {investment.name} no app do banco e copie o valor que aparece lá hoje.
          </DialogDescription>
        </DialogHeader>
        <ReconcileForm investment={investment} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ReconcileForm({ investment, onDone }: { investment: InvestmentView; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [amountStr, setAmountStr] = useState("");

  const hasValue = amountStr.trim() !== "";
  const appValueCents = inputToCents(amountStr);
  const estimatedCents = investment.summary.valueCents;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasValue || appValueCents < 0) {
      toast.error("Informe o valor que o app do banco mostra hoje.");
      return;
    }
    startTransition(async () => {
      const res = await reconcileInvestment({ investmentId: investment.id, appValueCents });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const { adjustmentId, adjustmentCents } = res.data;
      if (adjustmentId === null || adjustmentCents === 0) {
        toast.success("Já estava igual, nada foi ajustado.");
      } else {
        toastWithUndo(`Ajuste de ${signedBrl(adjustmentCents)} registrado no ${investment.name}.`, () =>
          deleteInvestmentMovement(adjustmentId),
        );
      }
      onDone();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="reconcile-amount" className="text-xs">Quanto o app do banco mostra hoje?</Label>
        <Input
          id="reconcile-amount"
          inputMode="decimal"
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="R$ 0,00"
          className="mt-1 font-mono text-sm"
          autoFocus
          required
        />
      </div>

      <p aria-live="polite" className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
        {reconcilePreview(hasValue, appValueCents, estimatedCents)}
      </p>

      <p className="text-xs text-muted-foreground">
        A diferença entra no histórico como um ajuste e passa a contar no rendimento. Se errar, é só excluir o ajuste.
      </p>

      <DialogFooter className="pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={isPending || !hasValue}>
          {isPending ? "Acertando..." : "Acertar"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function reconcilePreview(hasValue: boolean, appValueCents: number, estimatedCents: number): string {
  const estimate = `Nós estimamos ${formatCentsToBrl(estimatedCents)}.`;
  if (!hasValue) return `${estimate} Digite o valor do app para ver o ajuste.`;
  const diffCents = appValueCents - estimatedCents;
  if (diffCents === 0) return "Já está igual, nada a ajustar.";
  return `${estimate} Vou ajustar ${signedBrl(diffCents)}.`;
}
