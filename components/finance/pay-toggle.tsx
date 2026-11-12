"use client";

import { useOptimistic, useTransition } from "react";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions/result";
import { setTransactionPaid } from "@/lib/actions/finance-restore";

const UNDO_DURATION_MS = 10000;

// Aviso com botão "Desfazer". Usado em toda baixa e exclusão de Finanças,
// no lugar da janela de confirmação do navegador.
export function toastWithUndo(message: string, undo: () => Promise<ActionResult<unknown>>) {
  toast(message, {
    duration: UNDO_DURATION_MS,
    action: {
      label: "Desfazer",
      onClick: async () => {
        const res = await undo();
        if (!res.ok) toast.error(res.error);
      },
    },
  });
}

interface PayableTransaction {
  id: string;
  description: string;
  kind: string;
  status: string | null;
}

// Estado otimista de "pago" por lançamento: a bolinha muda na hora e volta sozinha se der erro.
export function usePayToggle() {
  const [, startTransition] = useTransition();
  const [overrides, setOverride] = useOptimistic<Record<string, boolean>, { id: string; paid: boolean }>(
    {},
    (state, change) => ({ ...state, [change.id]: change.paid }),
  );

  const isPaid = (tx: PayableTransaction) => overrides[tx.id] ?? tx.status === "paid";

  const toggle = (tx: PayableTransaction) => {
    const wasPaid = isPaid(tx);
    const nextPaid = !wasPaid;
    const isIncome = tx.kind === "income";

    startTransition(async () => {
      setOverride({ id: tx.id, paid: nextPaid });
      const res = await setTransactionPaid(tx.id, nextPaid);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const verb = nextPaid
        ? isIncome
          ? "marcada como recebida"
          : "marcada como paga"
        : isIncome
          ? "voltou para a receber"
          : "voltou para a pagar";
      toastWithUndo(`${tx.description} ${verb}.`, () => setTransactionPaid(tx.id, wasPaid));
    });
  };

  return { isPaid, toggle };
}

interface PayCheckProps {
  paid: boolean;
  income?: boolean;
  label: string;
  onToggle: () => void;
  className?: string;
}

// Bolinha de marcar como pago/recebido. É a única forma de dar baixa nas listas de Finanças.
export function PayCheck({ paid, income = false, label, onToggle, className = "" }: PayCheckProps) {
  const action = paid
    ? `Desmarcar ${label} (voltar para ${income ? "a receber" : "a pagar"})`
    : `Marcar ${label} como ${income ? "recebido" : "pago"}`;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={paid}
      aria-label={action}
      title={action}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`group/pay grid size-8 shrink-0 cursor-pointer place-items-center rounded-full ${className}`}
    >
      <span
        className={`grid size-5 place-items-center rounded-full border-[1.5px] transition-colors ${
          paid
            ? "border-emerald-500 bg-emerald-500 text-emerald-950"
            : "border-zinc-500 text-transparent group-hover/pay:border-emerald-400 group-hover/pay:text-emerald-400"
        }`}
      >
        <CheckIcon className="size-3" strokeWidth={3} />
      </span>
    </button>
  );
}
