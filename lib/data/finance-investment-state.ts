import "server-only";

import { type ActionResult, fail, ok } from "@/lib/actions/result";
import { addDays, todayIso, type IsoDate } from "@/lib/dates";
import { previousBusinessDay } from "@/lib/finance/business-days";
import {
  firstOverdrawnDate,
  parseRateChanges,
  simulateInvestment,
  type InvestmentMovement,
  type MovementKind,
  type RateEntry,
} from "@/lib/finance/investments";
import { createClient } from "@/lib/supabase/server";
import { getCdiSeries } from "./finance-cdi";

// Estado de UM investimento do usuário (taxas, movimentos ativos e CDI) para as actions
// conferirem, antes de gravar, se o saldo ficaria negativo em alguma data.

// Sem movimentos, ainda busca uns dias de CDI para mostrar a taxa atual.
const CDI_LOOKBACK_WITHOUT_MOVEMENTS_DAYS = 10;

const MOVEMENT_KINDS: readonly string[] = ["deposit", "withdrawal", "adjustment"] satisfies MovementKind[];

export type StoredInvestmentMovement = InvestmentMovement & { id: string };

export type InvestmentState = {
  rates: RateEntry[];
  movements: StoredInvestmentMovement[];
  cdiByDate: Map<IsoDate, number>;
  today: IsoDate;
};

export function isMovementKind(kind: string): kind is MovementKind {
  return MOVEMENT_KINDS.includes(kind);
}

// Pelo menos um dia útil antes da data mais antiga (e nunca menos que os últimos dias, para o CDI atual).
export function cdiStartDate(dates: IsoDate[], today: IsoDate): IsoDate {
  const recent = addDays(today, -CDI_LOOKBACK_WITHOUT_MOVEMENTS_DAYS);
  const oldest = dates.reduce<IsoDate | null>((min, date) => (min === null || date < min ? date : min), null);
  if (oldest === null) return recent;
  const beforeOldest = previousBusinessDay(oldest);
  return beforeOldest < recent ? beforeOldest : recent;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// O FK ignora RLS: confirmar aqui que o investimento é do usuário e não está na lixeira.
async function readOwnedRates(supabase: SupabaseClient, ownerId: string, investmentId: string): Promise<RateEntry[] | null> {
  const { data, error } = await supabase
    .from("finance_investments")
    .select("rate_changes")
    .eq("id", investmentId)
    .eq("user_id", ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? parseRateChanges(data.rate_changes) : null;
}

async function readActiveMovements(
  supabase: SupabaseClient,
  ownerId: string,
  investmentId: string,
): Promise<StoredInvestmentMovement[]> {
  const { data, error } = await supabase
    .from("finance_investment_movements")
    .select("id, date, kind, amount_cents")
    .eq("user_id", ownerId)
    .eq("investment_id", investmentId)
    .is("deleted_at", null);
  if (error) throw error;
  return data
    .filter((row) => isMovementKind(row.kind))
    .map((row) => ({ id: row.id, date: row.date, kind: row.kind as MovementKind, amountCents: row.amount_cents }));
}

async function readInvestmentState(ownerId: string, investmentId: string, extraDates: IsoDate[]): Promise<InvestmentState | null> {
  const supabase = await createClient();
  const today = todayIso();
  const rates = await readOwnedRates(supabase, ownerId, investmentId);
  if (rates === null) return null;
  const movements = await readActiveMovements(supabase, ownerId, investmentId);
  const { cdiByDate } = await getCdiSeries(cdiStartDate([...movements.map((m) => m.date), ...extraDates], today));
  return { rates, movements, cdiByDate, today };
}

// `extraDates`: datas que ainda não estão nos movimentos (novo movimento, edição, restauração),
// para o CDI cobrir também esses dias.
export async function loadInvestmentState(
  ownerId: string,
  investmentId: string,
  extraDates: IsoDate[] = [],
): Promise<ActionResult<InvestmentState>> {
  try {
    const state = await readInvestmentState(ownerId, investmentId, extraDates);
    return state ? ok(state) : fail("Investimento não encontrado.");
  } catch (error) {
    console.error("loadInvestmentState error:", error);
    return fail("Não foi possível ler o investimento. Tente de novo.");
  }
}

export function movementsWithout(state: InvestmentState, movementId: string | null): InvestmentMovement[] {
  return state.movements.filter((movement) => movement.id !== movementId);
}

function overdrawnDateOf(state: InvestmentState, movements: InvestmentMovement[], rates: RateEntry[]): IsoDate | null {
  return firstOverdrawnDate(movements, rates, state.cdiByDate, state.today);
}

// Primeiro dia em que `planned` (com as taxas `plannedRates`) deixa o saldo negativo, ou null. Se o histórico
// atual já estava negativo (ex.: taxa mudada depois de um "Resgatar tudo"), só barra quando a mudança
// antecipa esse dia, para o investimento não ficar travado.
export function newOverdrawnDate(
  state: InvestmentState,
  planned: InvestmentMovement[],
  plannedRates: RateEntry[] = state.rates,
): IsoDate | null {
  const date = overdrawnDateOf(state, planned, plannedRates);
  if (date === null) return null;
  const current = overdrawnDateOf(state, state.movements, state.rates);
  return current === null || date < current ? date : null;
}

// Valor (arredondado) no fim do dia `date`, já com os movimentos desse dia.
export function valueOn(state: InvestmentState, movements: InvestmentMovement[], date: IsoDate): number {
  return simulateInvestment({ movements, rates: state.rates, cdiByDate: state.cdiByDate, asOf: date, month: date.slice(0, 7) })
    .valueCents;
}

// "13/11" (ou "13/11/2025" se não for do ano de hoje).
export function formatDayMonth(iso: IsoDate, today: IsoDate): string {
  const dayMonth = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? dayMonth : `${dayMonth}/${iso.slice(0, 4)}`;
}
