"use client";

import { ArrowDownRightIcon, ArrowUpRightIcon, PercentIcon, ScaleIcon, WalletIcon } from "lucide-react";

import { formatCentsToBrl } from "@/lib/money";

interface MetricsCardsProps {
  totalIncomeCents: number;
  totalExpenseCents: number;
  netBalanceCents: number;
  profitMarginPercent: number;
  transactionCount: number;
  ledger: "all" | "pessoal" | "trustcare";
}

export function MetricsCards({
  totalIncomeCents,
  totalExpenseCents,
  netBalanceCents,
  profitMarginPercent,
  transactionCount,
  ledger,
}: MetricsCardsProps) {
  const isPositive = netBalanceCents >= 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Total Entradas */}
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-emerald-500/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Entradas</span>
          <div className="flex size-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <ArrowUpRightIcon className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
            {formatCentsToBrl(totalIncomeCents)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ledger === "trustcare"
              ? "Serviços e vendas faturadas"
              : ledger === "pessoal"
                ? "Salário e rendimentos recebidos"
                : "Receitas consolidadas do mês"}
          </p>
        </div>
      </div>

      {/* 2. Total Saídas */}
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-rose-500/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Total Saídas</span>
          <div className="flex size-7 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400">
            <ArrowDownRightIcon className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-rose-400 tabular-nums">
            {formatCentsToBrl(totalExpenseCents)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ledger === "trustcare"
              ? "Peças, insumos e custos operacionais"
              : ledger === "pessoal"
                ? "Gastos essenciais e pessoais"
                : "Despesas totais computadas"}
          </p>
        </div>
      </div>

      {/* 3. Saldo Líquido */}
      <div
        className={`relative overflow-hidden rounded-xl border p-4 shadow-sm backdrop-blur-sm transition-all ${
          isPositive
            ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
            : "border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Saldo Líquido</span>
          <div
            className={`flex size-7 items-center justify-center rounded-lg border ${
              isPositive
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
                : "border-rose-500/30 bg-rose-500/15 text-rose-400"
            }`}
          >
            <ScaleIcon className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <div
            className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
              isPositive ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {formatCentsToBrl(netBalanceCents)}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {isPositive ? "Superávit no período" : "Déficit / Atenção aos gastos"}
          </p>
        </div>
      </div>

      {/* 4. Margem Operacional / Taxa de Retenção */}
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-primary/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {ledger === "trustcare" ? "Margem de Lucro" : ledger === "pessoal" ? "Taxa de Poupança" : "Margem Global"}
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <PercentIcon className="size-4" />
          </div>
        </div>
        <div className="mt-3">
          <div className="font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {profitMarginPercent > 0 ? `+${profitMarginPercent.toFixed(1)}%` : `${profitMarginPercent.toFixed(1)}%`}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {transactionCount} {transactionCount === 1 ? "lançamento" : "lançamentos"} no mês
          </p>
        </div>
      </div>
    </div>
  );
}
