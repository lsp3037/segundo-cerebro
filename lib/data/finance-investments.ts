import "server-only";

import { todayIso, type IsoDate } from "@/lib/dates";
import { isBusinessDay, isWeekend } from "@/lib/finance/business-days";
import { getFinanceScope } from "@/lib/finance/scope";
import {
  parseRateChanges,
  simulateInvestment,
  type InvestmentMovement,
  type MovementKind,
} from "@/lib/finance/investments";
import type {
  CdiInfo,
  InvestmentMovementView,
  InvestmentsData,
  InvestmentsTotals,
  InvestmentView,
} from "@/lib/finance/investments-data";
import { createClient } from "@/lib/supabase/server";
import { getCdiSeries } from "./finance-cdi";
import { cdiStartDate, isMovementKind } from "./finance-investment-state";

type InvestmentRow = {
  id: string;
  name: string;
  owner_label: string | null;
  notes: string | null;
  rate_changes: unknown;
};

type MovementRow = InvestmentMovementView & { investmentId: string; createdAt: string };

const EMPTY_TOTALS: InvestmentsTotals = {
  valueCents: 0,
  depositedCents: 0,
  withdrawnCents: 0,
  yieldTodayCents: 0,
  yieldMonthCents: 0,
  yieldTotalCents: 0,
  nextCreditCents: 0,
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function readInvestments(supabase: SupabaseClient, ownerId: string, member: string | null): Promise<InvestmentRow[]> {
  let query = supabase
    .from("finance_investments")
    .select("id, name, owner_label, notes, rate_changes")
    .eq("user_id", ownerId)
    .is("deleted_at", null);
  if (member) query = query.eq("owner_label", member);
  const { data, error } = await query.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

async function readMovements(supabase: SupabaseClient, ownerId: string, investmentIds: string[]): Promise<MovementRow[]> {
  if (investmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .select("id, investment_id, date, kind, amount_cents, note, created_at")
    .eq("user_id", ownerId)
    .in("investment_id", investmentIds)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data
    .filter((row) => isMovementKind(row.kind))
    .map((row) => ({
      id: row.id,
      investmentId: row.investment_id,
      date: row.date,
      kind: row.kind as MovementKind,
      amountCents: row.amount_cents,
      note: row.note,
      createdAt: row.created_at,
    }));
}

function sumTotals(investments: InvestmentView[]): InvestmentsTotals {
  return investments.reduce<InvestmentsTotals>(
    (totals, { summary }) => ({
      valueCents: totals.valueCents + summary.valueCents,
      depositedCents: totals.depositedCents + summary.depositedCents,
      withdrawnCents: totals.withdrawnCents + summary.withdrawnCents,
      yieldTodayCents: totals.yieldTodayCents + summary.yieldTodayCents,
      yieldMonthCents: totals.yieldMonthCents + summary.yieldMonthCents,
      yieldTotalCents: totals.yieldTotalCents + summary.yieldTotalCents,
      nextCreditCents: totals.nextCreditCents + summary.nextCreditCents,
    }),
    EMPTY_TOTALS,
  );
}

// Hoje rende se o Banco Central publicou CDI para hoje (raro) ou, senão, se é dia útil no calendário.
function todayStatus(today: IsoDate, cdiByDate: Map<IsoDate, number>) {
  const todayIsBusinessDay = cdiByDate.has(today) || isBusinessDay(today);
  const todayReason = todayIsBusinessDay ? null : isWeekend(today) ? ("weekend" as const) : ("holiday" as const);
  return { todayIsBusinessDay, todayReason };
}

function emptyData(today: IsoDate, cdi: CdiInfo): InvestmentsData {
  return { investments: [], totals: EMPTY_TOTALS, cdi, today, ...todayStatus(today, new Map()), error: true };
}

async function loadInvestmentsData(ownerId: string, member: string | null, month: string, today: IsoDate): Promise<InvestmentsData> {
  const supabase = await createClient();
  const investmentRows = await readInvestments(supabase, ownerId, member);
  const movementRows = await readMovements(
    supabase,
    ownerId,
    investmentRows.map((row) => row.id),
  );
  const { cdiByDate, info } = await getCdiSeries(cdiStartDate(movementRows.map((row) => row.date), today));

  const investments = investmentRows.map((row): InvestmentView => {
    const ownMovements = movementRows.filter((movement) => movement.investmentId === row.id);
    const rates = parseRateChanges(row.rate_changes);
    const simulated: InvestmentMovement[] = ownMovements.map(({ date, kind, amountCents }) => ({ date, kind, amountCents }));
    return {
      id: row.id,
      name: row.name,
      ownerLabel: row.owner_label,
      notes: row.notes,
      rates,
      summary: simulateInvestment({ movements: simulated, rates, cdiByDate, asOf: today, month }),
      movements: ownMovements.map(({ id, date, kind, amountCents, note }) => ({ id, date, kind, amountCents, note })),
    };
  });

  return { investments, totals: sumTotals(investments), cdi: info, today, ...todayStatus(today, cdiByDate) };
}

// Dados da aba Investimentos (Finanças › Pessoal). Nunca lança: em erro devolve `error: true` e listas vazias.
// O escopo (e o usuário) é lido fora do try: o `redirect` do login não pode ser engolido.
export async function getInvestmentsData(params: { member?: string | null; month: string }): Promise<InvestmentsData> {
  const scope = await getFinanceScope();
  const today = todayIso();
  try {
    return await loadInvestmentsData(scope.ownerId, params.member || null, params.month, today);
  } catch (error) {
    console.error("getInvestmentsData error:", error);
    return emptyData(today, { lastDate: null, dailyPercent: null, annualPercent: null, stale: true });
  }
}
