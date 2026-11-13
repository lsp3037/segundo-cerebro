"use client";

import { useTransition } from "react";
import { AlertTriangleIcon, CheckIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { AsideCard } from "@/components/today/aside-card";
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
    <AsideCard
      icon={overdueCount > 0 ? AlertTriangleIcon : WalletIcon}
      title="Contas da semana"
      tone={overdueCount > 0 ? "danger" : "warning"}
      action={{ label: "Ver todas", href: "/financas?ledger=pessoal&tab=fluxo" }}
    >
      <ul>
        {bills.map((b) => {
          const isOverdue = b.billStatus === "overdue";
          const dLabel = b.due_date ? `${b.due_date.slice(8)}/${b.due_date.slice(5, 7)}` : "Sem dia";
          return (
            <li key={b.id} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate leading-5 font-medium">{b.description}</p>
                <p className={`text-xs ${isOverdue ? "font-medium text-rose-400" : "text-muted-foreground"}`}>
                  {isOverdue ? `Atrasada (${dLabel})` : `Vence ${dLabel}`}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatCentsToBrl(b.amount_cents)}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handlePay(b)}
                title="Marcar como pago"
                aria-label={`Marcar "${b.description}" como paga`}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-emerald-950 disabled:opacity-50"
              >
                <CheckIcon className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </AsideCard>
  );
}
