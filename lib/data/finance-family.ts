import "server-only";

import {
  billStatus,
  computeMonthKpis,
  daysInMonth,
  dueDateFor,
  monthKey,
  percentChange,
  percentOfCents,
  shiftMonth,
  type BillStatus,
  type MonthKpis,
} from "@/lib/finance/household";
import { billAmountForMonth, isBillActiveInMonth } from "@/lib/finance/recurring";
import type { FinanceSummary } from "./finance";
import { todayIso, addDays } from "@/lib/dates";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type FinanceAccount = Tables<"finance_accounts">;
export type RecurringBill = Tables<"finance_recurring_bills">;

export type HouseholdTransaction = Tables<"transactions"> & {
  billStatus: BillStatus;
  categoryName: string | null;
  categoryColor: string | null;
  accountName: string | null;
};

export type AccountWithBalance = FinanceAccount & {
  balanceCents: number; // contas: saldo inicial + pagos
  monthInvoiceCents: number; // cartões: total do mês selecionado
};

export type BudgetRow = {
  categoryId: string;
  categoryName: string;
  color: string | null;
  budgetCents: number | null;
  spentCents: number;
};

export type ComparisonRow = {
  categoryId: string | null;
  categoryName: string;
  currentCents: number;
  previousCents: number;
  average3Cents: number;
  changePercent: number | null;
};

export type TrendPoint = {
  month: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
};

export type MemberSlice = { member: string; expenseCents: number; percent: number };

export type UpcomingBill = {
  id: string;
  description: string;
  amount_cents: number;
  due_date: string | null;
  date: string;
  member_label: string | null;
  billStatus: BillStatus;
};

export type HouseholdData = {
  month: string;
  today: string;
  member: string | null;
  transactions: HouseholdTransaction[];
  kpis: MonthKpis;
  previousKpis: MonthKpis;
  accounts: AccountWithBalance[];
  recurringBills: RecurringBill[];
  budgets: BudgetRow[];
  comparison: ComparisonRow[];
  categoriesBreakdown: FinanceSummary["categoriesBreakdown"];
  trend: TrendPoint[];
  members: MemberSlice[];
  upcoming: UpcomingBill[];
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function monthBounds(month: string) {
  return { start: `${month}-01`, end: `${month}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

// Cria os lançamentos pendentes do mês a partir das contas fixas (só mês atual e futuros)
// e mantém o Dízimo pendente igual ao percentual das entradas do mês.
// Quando `allowPastTithe` é true (ação explícita "Gerar 10%"), permite gerar o Dízimo em meses passados sem recriar contas fixas antigas.
export async function ensureMonthBills(
  userId: string,
  month: string,
  options?: { syncPendingFixed?: boolean; allowPastTithe?: boolean },
): Promise<{ titheTouched: boolean }> {
  const isPastMonth = month < monthKey(todayIso());
  if (isPastMonth && !options?.allowPastTithe) {
    return { titheTouched: false };
  }

  let titheTouched = false;
  try {
    const supabase = await createClient();
    const { data: allBills } = await supabase
      .from("finance_recurring_bills")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("sort_order");

    if (!allBills || allBills.length === 0) return { titheTouched: false };
    // Só vale o que está dentro do período e não foi pulado neste mês.
    const bills = allBills.filter((b) => isBillActiveInMonth(b, month));
    const outOfPeriodIds = new Set(allBills.filter((b) => !isBillActiveInMonth(b, month)).map((b) => b.id));

    const { start, end } = monthBounds(month);
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, recurring_bill_id, status, amount_cents, due_date, description, category_id")
      .eq("user_id", userId)
      .eq("ledger", "pessoal")
      .is("deleted_at", null)
      .gte("date", start)
      .lte("date", end);

    const existingList = existing ?? [];
    const existingByBill = new Map(
      existingList.filter((t) => t.recurring_bill_id).map((t) => [t.recurring_bill_id!, t]),
    );

    const rowFor = (bill: RecurringBill, amount: number): TablesInsert<"transactions"> => {
      const due = dueDateFor(month, bill.due_day);
      return {
        user_id: userId,
        ledger: "pessoal",
        kind: bill.kind,
        amount_cents: amount,
        date: due ?? start,
        due_date: due,
        description: bill.description,
        category_id: bill.category_id,
        account_id: bill.account_id,
        member_label: bill.member_label,
        recurring_bill_id: bill.id,
        status: "pending",
      };
    };

    // 1. Contas de valor fixo (apenas no mês atual ou futuros)
    if (!isPastMonth) {
      // Fim do período ou mês pulado: some o lançamento que ainda está pendente.
      for (const id of outOfPeriodIds) {
        const stale = existingByBill.get(id);
        if (stale && stale.status === "pending") {
          await supabase.from("transactions").delete().eq("id", stale.id).eq("user_id", userId);
        }
      }

      const fixedBills = bills.filter((b) => b.amount_mode === "fixed" && billAmountForMonth(b, month) > 0);
      const fixedRows = fixedBills
        .filter((b) => !existingByBill.has(b.id))
        .map((b) => rowFor(b, billAmountForMonth(b, month)));
      await insertIgnoringDuplicates(fixedRows);

      if (options?.syncPendingFixed) {
        for (const b of fixedBills) {
          const cur = existingByBill.get(b.id);
          if (!cur || cur.status !== "pending") continue;
          const targetDue = dueDateFor(month, b.due_day);
          const target = billAmountForMonth(b, month);
          if (cur.amount_cents !== target || cur.due_date !== targetDue) {
            await supabase
              .from("transactions")
              .update({ amount_cents: target, due_date: targetDue, updated_at: new Date().toISOString() })
              .eq("id", cur.id)
              .eq("user_id", userId);
          }
        }
      }
    }

    // 2. Contas percentuais (Dízimo) sobre as entradas do mês
    const percentBills = bills.filter((b) => b.amount_mode === "percent_of_income" && b.percent_bp);
    if (percentBills.length === 0) return { titheTouched: false };

    const { data: incomes } = await supabase
      .from("transactions")
      .select("amount_cents")
      .eq("user_id", userId)
      .eq("ledger", "pessoal")
      .eq("kind", "income")
      .is("deleted_at", null)
      .gte("date", start)
      .lte("date", end);
    const incomeCents = (incomes ?? []).reduce((acc, t) => acc + t.amount_cents, 0);

    for (const bill of percentBills) {
      const expectedTotal = percentOfCents(incomeCents, bill.percent_bp!);
      const current = existingByBill.get(bill.id);
      const complementRow = existingList.find(
        (t) =>
          !t.recurring_bill_id &&
          t.status === "pending" &&
          t.description === `${bill.description} (complemento)`,
      );

      // Soma tudo o que já foi pago no mês dessa conta/categoria (inclui lançamentos manuais com descrição Dízimo)
      const paidTitheCents = existingList
        .filter(
          (t) =>
            t.status === "paid" &&
            (t.recurring_bill_id === bill.id ||
              t.description === `${bill.description} (complemento)` ||
              /^d[íi]zimo/i.test(t.description)),
        )
        .reduce((acc, t) => acc + t.amount_cents, 0);

      const remaining = Math.max(0, expectedTotal - paidTitheCents);

      if (!current) {
        if (remaining > 0) {
          await insertIgnoringDuplicates([rowFor(bill, remaining)]);
          titheTouched = true;
        }
      } else if (current.status === "pending") {
        if (remaining > 0) {
          if (current.amount_cents !== remaining) {
            await supabase
              .from("transactions")
              .update({ amount_cents: remaining, updated_at: new Date().toISOString() })
              .eq("id", current.id)
              .eq("user_id", userId);
            titheTouched = true;
          }
        } else {
          // Sem entradas suficientes no mês ou já totalmente quitado: remove o pendente vazio.
          await supabase.from("transactions").delete().eq("id", current.id).eq("user_id", userId);
          titheTouched = true;
        }
      } else if (current.status === "paid") {
        // O dízimo principal já foi pago, mas entrou nova receita no mês: cria/atualiza o complemento.
        if (remaining > 0) {
          if (complementRow && complementRow.status === "pending") {
            if (complementRow.amount_cents !== remaining) {
              await supabase
                .from("transactions")
                .update({ amount_cents: remaining, updated_at: new Date().toISOString() })
                .eq("id", complementRow.id)
                .eq("user_id", userId);
              titheTouched = true;
            }
          } else if (!complementRow) {
            await supabase.from("transactions").insert({
              user_id: userId,
              ledger: "pessoal",
              kind: "expense",
              amount_cents: remaining,
              date: dueDateFor(month, bill.due_day) ?? start,
              due_date: dueDateFor(month, bill.due_day),
              description: `${bill.description} (complemento)`,
              category_id: bill.category_id,
              account_id: bill.account_id,
              member_label: bill.member_label,
              recurring_bill_id: null,
              status: "pending",
            });
            titheTouched = true;
          }
        } else if (complementRow && complementRow.status === "pending") {
          await supabase.from("transactions").delete().eq("id", complementRow.id).eq("user_id", userId);
          titheTouched = true;
        }
      }
    }
  } catch (err) {
    console.error("ensureMonthBills error:", err);
  }
  return { titheTouched };
}

async function insertIgnoringDuplicates(rows: TablesInsert<"transactions">[]) {
  if (rows.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(rows);
  if (!error) return;
  // Outra aba pode ter gerado o mesmo mês ao mesmo tempo: insere um a um e ignora repetidos.
  for (const row of rows) {
    await supabase.from("transactions").insert(row);
  }
}

export async function getRecurringBills(): Promise<RecurringBill[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("finance_recurring_bills")
    .select("*")
    .is("deleted_at", null)
    .order("kind", { ascending: false })
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
}

export async function getHouseholdData(params: { month: string; member?: string | null }): Promise<HouseholdData> {
  const supabase = await createClient();
  const today = todayIso();
  const month = params.month;
  const member = params.member || null;
  const trendStart = `${shiftMonth(month, -5)}-01`;
  const { end } = monthBounds(month);

  const [txRes, catsRes, accountsRes, budgetsRes, billsRes, accountTxRes, upcomingRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .eq("ledger", "pessoal")
      .is("deleted_at", null)
      .gte("date", trendStart)
      .lte("date", end)
      .order("date", { ascending: true }),
    supabase.from("finance_categories").select("id, name, color, kind, ledger").is("deleted_at", null),
    supabase.from("finance_accounts").select("*").is("deleted_at", null).order("sort_order").order("created_at"),
    supabase.from("finance_budgets").select("*"),
    supabase.from("finance_recurring_bills").select("*").is("deleted_at", null).order("sort_order"),
    supabase
      .from("transactions")
      .select("account_id, kind, amount_cents, status, date, member_label")
      .not("account_id", "is", null)
      .is("deleted_at", null),
    getUpcomingHouseholdBills(50),
  ]);

  if (txRes.error) throw txRes.error;

  const cats = catsRes.data ?? [];
  const catsMap = new Map(cats.map((c) => [c.id, c]));
  const accounts = accountsRes.data ?? [];
  const accountsMap = new Map(accounts.map((a) => [a.id, a]));

  const byMember = (t: { member_label: string | null }) => !member || t.member_label === member;
  const all = (txRes.data ?? []).filter(byMember);

  const enrich = (t: Tables<"transactions">): HouseholdTransaction => {
    const cat = t.category_id ? catsMap.get(t.category_id) : null;
    return {
      ...t,
      billStatus: billStatus(t, today),
      categoryName: cat?.name ?? null,
      categoryColor: cat?.color ?? null,
      accountName: t.account_id ? accountsMap.get(t.account_id)?.name ?? null : null,
    };
  };

  const byMonth = new Map<string, Tables<"transactions">[]>();
  for (const t of all) {
    const key = monthKey(t.date);
    const list = byMonth.get(key) ?? [];
    list.push(t);
    byMonth.set(key, list);
  }

  const fixedDescriptions = new Set(
    (billsRes.data ?? [])
      .filter((b) => b.kind === "expense")
      .map((b) => b.description.trim().toLowerCase()),
  );

  const current = byMonth.get(month) ?? [];
  const previous = byMonth.get(shiftMonth(month, -1)) ?? [];
  const kpis = computeMonthKpis(current, daysInMonth(month), { fixedDescriptions });
  const previousKpis = computeMonthKpis(previous, daysInMonth(shiftMonth(month, -1)), { fixedDescriptions });

  // Tendência de 6 meses (previsto: pagos + pendentes)
  const trend: TrendPoint[] = Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(month, i - 5);
    const k = computeMonthKpis(byMonth.get(m) ?? [], daysInMonth(m), { fixedDescriptions });
    const [y, mm] = m.split("-");
    return {
      month: m,
      label: `${MONTH_NAMES[Number(mm) - 1]}/${y.slice(2)}`,
      incomeCents: k.incomeCents,
      expenseCents: k.expenseCents,
      balanceCents: k.projectedBalanceCents,
    };
  });

  // Saídas por categoria em cada mês
  const expenseByCategory = (list: Tables<"transactions">[]) => {
    const map = new Map<string, number>();
    for (const t of list) {
      if (t.kind !== "expense") continue;
      const key = t.category_id ?? "none";
      map.set(key, (map.get(key) ?? 0) + t.amount_cents);
    }
    return map;
  };
  const curByCat = expenseByCategory(current);
  const prevByCat = expenseByCategory(previous);
  const histByCat = [1, 2, 3].map((i) => expenseByCategory(byMonth.get(shiftMonth(month, -i)) ?? []));

  const comparisonKeys = new Set([...curByCat.keys(), ...prevByCat.keys()]);
  const comparison: ComparisonRow[] = [...comparisonKeys]
    .map((key) => {
      const currentCents = curByCat.get(key) ?? 0;
      const previousCents = prevByCat.get(key) ?? 0;
      const average3Cents = Math.round(histByCat.reduce((acc, m) => acc + (m.get(key) ?? 0), 0) / 3);
      return {
        categoryId: key === "none" ? null : key,
        categoryName: key === "none" ? "Sem categoria" : catsMap.get(key)?.name ?? "Sem categoria",
        currentCents,
        previousCents,
        average3Cents,
        changePercent: percentChange(currentCents, previousCents),
      };
    })
    .sort((a, b) => b.currentCents - a.currentCents);

  // Metas por categoria (categorias pessoais de saída com meta ou com gasto no mês)
  const budgetMap = new Map((budgetsRes.data ?? []).map((b) => [b.category_id, b.amount_cents]));
  const budgets: BudgetRow[] = cats
    .filter((c) => c.ledger === "pessoal" && c.kind === "expense")
    .filter((c) => budgetMap.has(c.id) || curByCat.has(c.id))
    .map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      color: c.color,
      budgetCents: budgetMap.get(c.id) ?? null,
      spentCents: curByCat.get(c.id) ?? 0,
    }))
    .sort((a, b) => (b.budgetCents ?? 0) - (a.budgetCents ?? 0) || b.spentCents - a.spentCents);

  // Saídas do mês por pessoa (sem o filtro de pessoa, para comparar)
  const monthAllMembers = (txRes.data ?? []).filter((t) => monthKey(t.date) === month && t.kind === "expense");
  const memberTotals = new Map<string, number>();
  for (const t of monthAllMembers) {
    const key = t.member_label ?? "Sem pessoa";
    memberTotals.set(key, (memberTotals.get(key) ?? 0) + t.amount_cents);
  }
  const memberSum = [...memberTotals.values()].reduce((a, b) => a + b, 0);
  const members: MemberSlice[] = [...memberTotals.entries()]
    .map(([m, cents]) => ({ member: m, expenseCents: cents, percent: memberSum > 0 ? Math.round((cents / memberSum) * 1000) / 10 : 0 }))
    .sort((a, b) => b.expenseCents - a.expenseCents);

  // Distribuição por categoria sincronizada com o filtro de Pessoa atual
  const buildBreakdown = (kind: "expense" | "income"): FinanceSummary["categoriesBreakdown"] => {
    const kindTxs = current.filter((t) => t.kind === kind);
    const kindTotal = kindTxs.reduce((acc, t) => acc + t.amount_cents, 0);
    const grouped = new Map<string, { categoryId: string | null; categoryName: string; color: string | null; totalCents: number }>();
    for (const t of kindTxs) {
      const cat = t.category_id ? catsMap.get(t.category_id) : null;
      const key = t.category_id ?? "none";
      const cur = grouped.get(key) ?? {
        categoryId: t.category_id,
        categoryName: cat?.name ?? "Sem categoria",
        color: cat?.color ?? null,
        totalCents: 0,
      };
      cur.totalCents += t.amount_cents;
      grouped.set(key, cur);
    }
    return [...grouped.values()]
      .sort((a, b) => b.totalCents - a.totalCents)
      .map((item) => ({
        ...item,
        kind,
        percentage: kindTotal > 0 ? Math.round((item.totalCents / kindTotal) * 100) : 0,
      }));
  };
  const categoriesBreakdown: FinanceSummary["categoriesBreakdown"] = [
    ...buildBreakdown("expense"),
    ...buildBreakdown("income"),
  ];

  // Saldo das contas e fatura dos cartões (respeitando filtro de Pessoa nas faturas)
  const accountTx = accountTxRes.data ?? [];
  const accountsWithBalance: AccountWithBalance[] = accounts.map((a) => {
    let balanceCents = a.opening_balance_cents;
    let monthInvoiceCents = 0;
    for (const t of accountTx) {
      if (t.account_id !== a.id) continue;
      if (a.type === "credit_card") {
        if (t.kind === "expense" && monthKey(t.date) === month && byMember(t)) monthInvoiceCents += t.amount_cents;
      } else if (t.status === "paid") {
        balanceCents += t.kind === "income" ? t.amount_cents : -t.amount_cents;
      }
    }
    return { ...a, balanceCents, monthInvoiceCents };
  });

  const upcoming = upcomingRes.filter(byMember);

  return {
    month,
    today,
    member,
    transactions: current.map(enrich).sort((a, b) => a.date.localeCompare(b.date)),
    kpis,
    previousKpis,
    accounts: accountsWithBalance,
    recurringBills: billsRes.data ?? [],
    budgets,
    comparison,
    categoriesBreakdown,
    trend,
    members,
    upcoming,
  };
}

// Contas pendentes atrasadas ou vencendo nos próximos 7 dias (card da tela Hoje).
export async function getUpcomingHouseholdBills(limit = 8): Promise<UpcomingBill[]> {
  const supabase = await createClient();
  const today = todayIso();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, description, amount_cents, due_date, date, member_label, status")
    .eq("ledger", "pessoal")
    .eq("status", "pending")
    .is("deleted_at", null)
    .lte("due_date", addDays(today, 7))
    .order("due_date")
    .limit(limit);
  if (error) {
    console.error("getUpcomingHouseholdBills error:", error);
    return [];
  }
  return (data ?? []).map((t) => ({ ...t, billStatus: billStatus(t, today) }));
}
