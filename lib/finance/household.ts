// Regras puras das finanças da casa (sem banco, usadas no servidor e no cliente).

export const HOUSEHOLD_MEMBERS = ["Casa", "Luan", "Rayzza"] as const;

export type BillStatus = "paid" | "pending" | "overdue";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  paid: "Pago",
  pending: "Pendente",
  overdue: "Atrasado",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Conta corrente",
  savings: "Reserva / Investimento",
  cash: "Dinheiro",
  credit_card: "Cartão de crédito",
};

// Atrasado = pendente com vencimento antes de hoje (datas em Cuiabá, "AAAA-MM-DD").
export function billStatus(tx: { status: string; due_date: string | null }, today: string): BillStatus {
  if (tx.status === "paid") return "paid";
  if (tx.due_date && tx.due_date < today) return "overdue";
  return "pending";
}

// Data de vencimento de um dia fixo dentro de um mês ("AAAA-MM"), limitada ao último dia.
export function dueDateFor(month: string, dueDay: number | null): string | null {
  if (!dueDay) return null;
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(dueDay, lastDay)).padStart(2, "0")}`;
}

// Percentual em pontos-base (1000 = 10%).
export function percentOfCents(cents: number, basisPoints: number): number {
  return Math.round((cents * basisPoints) / 10000);
}

// Divide um total em parcelas inteiras; a sobra dos centavos fica na primeira.
export function splitInstallments(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const rest = totalCents - base * count;
  return Array.from({ length: count }, (_, i) => (i === 0 ? base + rest : base));
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export type KpiTransaction = {
  kind: string;
  amount_cents: number;
  status: string;
  due_date: string | null;
  recurring_bill_id?: string | null;
  installment_group_id?: string | null;
  description?: string | null;
};

export type MonthKpis = {
  incomeCents: number;
  expenseCents: number;
  paidIncomeCents: number;
  paidExpenseCents: number;
  pendingIncomeCents: number;
  pendingExpenseCents: number;
  projectedBalanceCents: number;
  savingsRatePercent: number;
  fixedExpenseCents: number;
  fixedCommitmentPercent: number;
  fixedShareOfExpensesPercent: number;
  dailyBurnCents: number;
};

export type ComputeMonthKpisOptions = {
  fixedDescriptions?: Set<string>;
};

// Formata percentuais no padrão brasileiro (vírgula decimal, ex.: "21,2").
export function formatPercentPtBr(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

// KPIs do mês. Entradas e saídas contam pagos + pendentes (o previsto).
// "Fixo" = saída ligada a conta recorrente, descrição de conta fixa cadastrada ou vencimento não-parcelado.
export function computeMonthKpis(
  txs: KpiTransaction[],
  days: number,
  options?: ComputeMonthKpisOptions,
): MonthKpis {
  let paidIncomeCents = 0;
  let pendingIncomeCents = 0;
  let paidExpenseCents = 0;
  let pendingExpenseCents = 0;
  let fixedExpenseCents = 0;
  const fixedNames = options?.fixedDescriptions;

  for (const t of txs) {
    const paid = t.status === "paid";
    if (t.kind === "income") {
      if (paid) paidIncomeCents += t.amount_cents;
      else pendingIncomeCents += t.amount_cents;
    } else {
      if (paid) paidExpenseCents += t.amount_cents;
      else pendingExpenseCents += t.amount_cents;
      const descNorm = t.description?.trim().toLowerCase() ?? "";
      const isFixedByBill = Boolean(t.recurring_bill_id);
      const isFixedByDueDate = Boolean(t.due_date) && !t.installment_group_id;
      const isFixedByName = Boolean(descNorm && fixedNames?.has(descNorm));
      if (isFixedByBill || isFixedByDueDate || isFixedByName) {
        fixedExpenseCents += t.amount_cents;
      }
    }
  }

  const incomeCents = paidIncomeCents + pendingIncomeCents;
  const expenseCents = paidExpenseCents + pendingExpenseCents;
  const projectedBalanceCents = incomeCents - expenseCents;

  return {
    incomeCents,
    expenseCents,
    paidIncomeCents,
    paidExpenseCents,
    pendingIncomeCents,
    pendingExpenseCents,
    projectedBalanceCents,
    savingsRatePercent: incomeCents > 0 ? round1((projectedBalanceCents / incomeCents) * 100) : 0,
    fixedExpenseCents,
    fixedCommitmentPercent: incomeCents > 0 ? round1((fixedExpenseCents / incomeCents) * 100) : 0,
    fixedShareOfExpensesPercent: expenseCents > 0 ? round1((fixedExpenseCents / expenseCents) * 100) : 0,
    dailyBurnCents: days > 0 ? Math.round(expenseCents / days) : 0,
  };
}

// Variação percentual; null quando não há base de comparação.
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return round1(((current - previous) / previous) * 100);
}

export type BudgetLevel = "ok" | "warning" | "over";

export function budgetLevel(spentCents: number, budgetCents: number): BudgetLevel {
  if (budgetCents <= 0) return "ok";
  const ratio = spentCents / budgetCents;
  if (ratio > 1) return "over";
  if (ratio >= 0.8) return "warning";
  return "ok";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
