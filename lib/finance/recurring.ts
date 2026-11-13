// Regras dos itens recorrentes (contas e entradas fixas): período, reajuste e meses pulados.
// Fica fora de arquivos "use client"/"server-only" porque tela e servidor usam.

export type AmountChange = { from: string; amount_cents: number };

export type RecurringSchedule = {
  amount_cents: number;
  start_month?: string | null;
  end_month?: string | null;
  skipped_months?: string[] | null;
  amount_changes?: unknown;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Reajustes válidos, do mais antigo para o mais novo.
export function parseAmountChanges(raw: unknown): AmountChange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (c): c is AmountChange =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as AmountChange).from === "string" &&
        MONTH_RE.test((c as AmountChange).from) &&
        Number.isInteger((c as AmountChange).amount_cents) &&
        (c as AmountChange).amount_cents >= 0,
    )
    .sort((a, b) => a.from.localeCompare(b.from));
}

// Valor que vale em um mês: o último reajuste com início até aquele mês, ou o valor original.
export function billAmountForMonth(bill: RecurringSchedule, month: string): number {
  let amount = bill.amount_cents;
  for (const change of parseAmountChanges(bill.amount_changes)) {
    if (change.from <= month) amount = change.amount_cents;
  }
  return amount;
}

// Dentro do período (início e fim) e sem estar pulado naquele mês.
export function isBillActiveInMonth(bill: RecurringSchedule, month: string): boolean {
  if (bill.start_month && month < bill.start_month) return false;
  if (bill.end_month && month > bill.end_month) return false;
  return !(bill.skipped_months ?? []).includes(month);
}

export function isValidMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// "2026-12" -> "dez/2026"
export function formatMonthShortYear(month: string): string {
  return `${SHORT_MONTHS[Number(month.slice(5, 7)) - 1]}/${month.slice(0, 4)}`;
}
