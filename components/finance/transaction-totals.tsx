import { formatCentsToBrl } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { MonthTotals, TotalsPart } from "@/lib/finance/transaction-groups.types";

export type KindFilter = "all" | "income" | "expense";

interface TransactionTotalsProps {
  totals: MonthTotals;
  kindFilter: KindFilter;
  onToggleKind: (kind: "income" | "expense") => void;
}

function BigMoney({ cents, className }: { cents: number; className?: string }) {
  const digits = formatCentsToBrl(Math.abs(cents)).replace(/^R\$\s*/, "");
  return (
    <span className={cn("block font-semibold leading-[1.15] tracking-tight tabular-nums", className)}>
      {cents < 0 && "−"}
      <small className="mr-[3px] text-[max(12px,0.57em)] font-medium tracking-normal text-muted-foreground">R$</small>
      {digits}
    </span>
  );
}

function progressPercent(part: TotalsPart): number {
  if (part.totalCents <= 0) return 0;
  return Math.min(100, Math.round((part.doneCents / part.totalCents) * 100));
}

interface TotalColumnProps {
  label: string;
  part: TotalsPart;
  tone: "income" | "expense";
  doneLabel: string;
  pendingLabel: string;
  active: boolean;
  dimmed: boolean;
  onClick: () => void;
}

function TotalColumn({ label, part, tone, doneLabel, pendingLabel, active, dimmed, onClick }: TotalColumnProps) {
  const income = tone === "income";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={active ? "Mostrar entradas e saídas" : `Mostrar só ${income ? "entradas" : "saídas"}`}
      className={cn(
        "min-w-0 cursor-pointer rounded-lg text-left transition-opacity focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
        dimmed && "opacity-50 hover:opacity-100",
      )}
    >
      <span className={cn("block text-[13px] text-muted-foreground", active && "text-foreground")}>{label}</span>
      <BigMoney
        cents={part.totalCents}
        className={cn("mb-2.5 mt-1 text-[19px] md:text-[30px]", income ? "text-emerald-400" : "text-rose-400")}
      />
      <span className="block h-[5px] overflow-hidden rounded-[3px] bg-muted">
        <span
          className={cn("block h-full rounded-[3px] transition-[width] duration-300", income ? "bg-emerald-400" : "bg-rose-400")}
          style={{ width: `${progressPercent(part)}%` }}
        />
      </span>
      <span className="mt-2 hidden justify-between gap-2 text-[13px] tabular-nums text-foreground/75 md:flex">
        <span>
          {doneLabel} {formatCentsToBrl(part.doneCents)}
        </span>
        <span>
          Falta {formatCentsToBrl(part.pendingCents)}
        </span>
      </span>
      <span className="mt-1.5 block text-[12.5px] tabular-nums text-muted-foreground md:hidden">
        {pendingLabel} {formatCentsToBrl(part.pendingCents)}
      </span>
    </button>
  );
}

// Totais do mês em tipografia, sem cartões. Clicar em Entradas ou Saídas filtra a lista.
export function TransactionTotals({ totals, kindFilter, onToggleKind }: TransactionTotalsProps) {
  return (
    <section aria-label="Totais do mês" className="grid grid-cols-2 gap-x-4 gap-y-3.5 pb-5 md:grid-cols-3 md:gap-x-10 md:pb-[26px]">
      <TotalColumn
        label="Entradas do mês"
        part={totals.income}
        tone="income"
        doneLabel="Recebido"
        pendingLabel="Falta receber"
        active={kindFilter === "income"}
        dimmed={kindFilter === "expense"}
        onClick={() => onToggleKind("income")}
      />
      <TotalColumn
        label="Saídas do mês"
        part={totals.expense}
        tone="expense"
        doneLabel="Pago"
        pendingLabel="Falta pagar"
        active={kindFilter === "expense"}
        dimmed={kindFilter === "income"}
        onClick={() => onToggleKind("expense")}
      />
      <div className="order-first col-span-2 md:order-none md:col-span-1">
        <span className="block text-[13px] text-muted-foreground">Sobra prevista</span>
        <BigMoney cents={totals.netCents} className="mt-1 text-[32px] text-foreground md:text-[30px]" />
        <p className="mt-2 text-[13px] tabular-nums text-foreground/75">
          Hoje, já na conta: {formatCentsToBrl(totals.inHandCents)}
          <br />
          Contas a pagar até o fim do mês: {totals.expense.pendingCount}
        </p>
      </div>
    </section>
  );
}
