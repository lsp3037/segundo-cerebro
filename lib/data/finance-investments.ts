import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { addDays, todayIso, type IsoDate } from "@/lib/dates";
import { isBusinessDay, isWeekend, previousBusinessDay } from "@/lib/finance/business-days";
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

// Sem movimentos, ainda busca uns dias de CDI para mostrar a taxa atual.
const CDI_LOOKBACK_WITHOUT_MOVEMENTS_DAYS = 10;

const MOVEMENT_KINDS: readonly string[] = ["deposit", "withdrawal", "adjustment"] satisfies MovementKind[];

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

async function readInvestments(supabase: SupabaseClient, userId: string, member: string | null): Promise<InvestmentRow[]> {
  let query = supabase
    .from("finance_investments")
    .select("id, name, owner_label, notes, rate_changes")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if (member) query = query.eq("owner_label", member);
  const { data, error } = await query.order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

async function readMovements(supabase: SupabaseClient, userId: string, investmentIds: string[]): Promise<MovementRow[]> {
  if (investmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .select("id, investment_id, date, kind, amount_cents, note, created_at")
    .eq("user_id", userId)
    .in("investment_id", investmentIds)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data
    .filter((row) => MOVEMENT_KINDS.includes(row.kind))
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

// Pelo menos um dia útil antes do movimento mais antigo (e nunca menos que os últimos dias, para o CDI atual).
function cdiStartDate(movements: MovementRow[], today: IsoDate): IsoDate {
  const recent = addDays(today, -CDI_LOOKBACK_WITHOUT_MOVEMENTS_DAYS);
  const oldest = movements.reduce<IsoDate | null>((min, row) => (min === null || row.date < min ? row.date : min), null);
  if (oldest === null) return recent;
  const beforeOldest = previousBusinessDay(oldest);
  return beforeOldest < recent ? beforeOldest : recent;
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

async function loadInvestmentsData(userId: string, member: string | null, month: string, today: IsoDate): Promise<InvestmentsData> {
  const supabase = await createClient();
  const investmentRows = await readInvestments(supabase, userId, member);
  const movementRows = await readMovements(
    supabase,
    userId,
    investmentRows.map((row) => row.id),
  );
  const { cdiByDate, info } = await getCdiSeries(cdiStartDate(movementRows, today));

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
// O usuário é lido fora do try: o `redirect` do login não pode ser engolido.
export async function getInvestmentsData(params: { member?: string | null; month: string }): Promise<InvestmentsData> {
  const user = await getCurrentUser();
  const today = todayIso();
  try {
    return await loadInvestmentsData(user.id, params.member || null, params.month, today);
  } catch (error) {
    console.error("getInvestmentsData error:", error);
    return emptyData(today, { lastDate: null, dailyPercent: null, annualPercent: null, stale: true });
  }
}
