"use client";

import { useTransition } from "react";
import Link from "next/link";
import { AlertTriangleIcon, CheckIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { toggleTransactionPaid } from "@/lib/actions/finance-family";
import type { UpcomingBill } from "@/lib/data/finance-family";
import { formatCentsToBrl } from "@/lib/money";

interface UpcomingBillsCardProps {
  bills: UpcomingBill[];
}

export function UpcomingBillsCard({ bills }: UpcomingBillsCardProps) {
  const [isPending, startTransition] = useTransition();

  if (bills.length === 0) return null;

  const overdueCount = bills.filter((b) => b.billStatus === "overdue").length;

  const handlePay = (bill: UpcomingBill) => {
    startTransition(async () => {
      const res = await toggleTransactionPaid(bill.id);
      if (res.ok) toast.success(`"${bill.description}" pago!`);
      else toast.error(res.error);
    });
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3.5">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {overdueCount > 0 ? (
            <AlertTriangleIcon className="size-4 text-rose-400" />
          ) : (
            <WalletIcon className="size-4 text-amber-400" />
          )}
          <span>Contas da Semana</span>
        </div>
        <Link href="/financas?ledger=pessoal&tab=fluxo" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </div>

      <div className="mt-2 space-y-2">
        {bills.map((b) => {
          const isOverdue = b.billStatus === "overdue";
          const dLabel = b.due_date ? `${b.due_date.slice(8)}/${b.due_date.slice(5, 7)}` : "Sem dia";
          return (
            <div key={b.id} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{b.description}</div>
                <div className={`text-xs ${isOverdue ? "text-rose-400 font-medium" : "text-muted-foreground"}`}>
                  {isOverdue ? `Atrasada (${dLabel})` : `Vence ${dLabel}`}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono font-semibold tabular-nums">{formatCentsToBrl(b.amount_cents)}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handlePay(b)}
                  title="Marcar como pago"
                  className="inline-flex size-6 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500 hover:text-emerald-950"
                >
                  <CheckIcon className="size-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
