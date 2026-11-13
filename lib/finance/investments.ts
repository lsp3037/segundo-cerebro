// Regras dos investimentos (Cofrinho e afins): taxa por faixas do CDI ou fixa ao ano,
// rendimento só em dias úteis e simulação do saldo dia a dia. Valores brutos, em centavos.
// Fica fora de arquivos "use client"/"server-only" porque tela e servidor usam.

import { addDays, type IsoDate } from "@/lib/dates";
import { isBusinessDay, isWeekend, previousBusinessDay } from "@/lib/finance/business-days";

export type RateTier = { upToCents: number | null; ofCdiPercent: number };

export type RateEntry =
  | { from: IsoDate; mode: "cdi"; tiers: RateTier[] }
  | { from: IsoDate; mode: "annual"; annualPercent: number };

export type MovementKind = "deposit" | "withdrawal" | "adjustment";

// Aporte e resgate são positivos; o ajuste tem sinal.
export type InvestmentMovement = { date: IsoDate; kind: MovementKind; amountCents: number };

// Formato gravado em `finance_investments.rate_changes`.
export type RawRateTier = { up_to_cents: number | null; of_cdi_percent: number };
export type RawRateEntry =
  | { from: string; mode: "cdi"; tiers: RawRateTier[] }
  | { from: string; mode: "annual"; annual_percent: number };

export type NonBusinessReason = "weekend" | "holiday";

export type InvestmentSummary = {
  valueCents: number;
  depositedCents: number;
  withdrawnCents: number;
  adjustmentsCents: number;
  yieldTodayCents: number;
  todayIsBusinessDay: boolean;
  todayReason: NonBusinessReason | null;
  yieldMonthCents: number;
  yieldTotalCents: number;
  nextCreditCents: number;
  currentRate: RateEntry | null;
  cdiLastDate: IsoDate | null;
};

export type SimulateInvestmentInput = {
  movements: InvestmentMovement[];
  rates: RateEntry[];
  // CDI diário publicado pelo Banco Central, em fração (0,050788% → 0.00050788).
  cdiByDate: Map<IsoDate, number>;
  asOf: IsoDate;
  month: string; // "AAAA-MM"
};

export const BUSINESS_DAYS_PER_YEAR = 252;

// Cofrinho do Mercado Pago: 120% do CDI até R$ 10.000,00 e 100% no que passar disso.
export const COFRINHO_DEFAULT_TIERS: RateTier[] = [
  { upToCents: 1_000_000, ofCdiPercent: 120 },
  { upToCents: null, ofCdiPercent: 100 },
];

// Tolerância de meio centavo, porque o saldo simulado não é arredondado.
const OVERDRAWN_TOLERANCE_CENTS = 0.5;

// No mesmo dia: aportes, depois ajustes, depois resgates.
const KIND_ORDER: Record<MovementKind, number> = { deposit: 0, adjustment: 1, withdrawal: 2 };

const ISO_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ---------------------------------------------------------------------------
// Taxas: leitura e gravação do JSON do banco
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidCap(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value > 0);
}

function parseTier(raw: unknown): RateTier | null {
  if (!isRecord(raw) || !isValidCap(raw.up_to_cents) || !isNonNegativeNumber(raw.of_cdi_percent)) return null;
  return { upToCents: raw.up_to_cents, ofCdiPercent: raw.of_cdi_percent };
}

const capOf = (tier: RateTier) => tier.upToCents ?? Number.POSITIVE_INFINITY;

// Faixas em ordem crescente de teto; só a última fica sem teto (senão o que passa do teto não renderia).
function parseTiers(raw: unknown): RateTier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const tiers = raw.map(parseTier);
  if (tiers.some((tier) => tier === null)) return null;
  const sorted = (tiers as RateTier[]).sort((a, b) => capOf(a) - capOf(b));
  return sorted.filter((tier) => tier.upToCents === null).length === 1 ? sorted : null;
}

function parseRateEntry(raw: unknown): RateEntry | null {
  if (!isRecord(raw) || typeof raw.from !== "string" || !ISO_DATE_RE.test(raw.from)) return null;
  if (raw.mode === "annual") {
    return isNonNegativeNumber(raw.annual_percent)
      ? { from: raw.from, mode: "annual", annualPercent: raw.annual_percent }
      : null;
  }
  if (raw.mode !== "cdi") return null;
  const tiers = parseTiers(raw.tiers);
  return tiers ? { from: raw.from, mode: "cdi", tiers } : null;
}

// Entradas válidas, da mais antiga para a mais nova (na mesma data, vale a que vem depois).
export function parseRateChanges(raw: unknown): RateEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseRateEntry)
    .filter((entry): entry is RateEntry => entry !== null)
    .sort((a, b) => a.from.localeCompare(b.from));
}

export function serializeRateChanges(entries: RateEntry[]): RawRateEntry[] {
  return [...entries]
    .sort((a, b) => a.from.localeCompare(b.from))
    .map((entry) =>
      entry.mode === "annual"
        ? { from: entry.from, mode: "annual", annual_percent: entry.annualPercent }
        : {
            from: entry.from,
            mode: "cdi",
            tiers: entry.tiers.map((tier) => ({ up_to_cents: tier.upToCents, of_cdi_percent: tier.ofCdiPercent })),
          },
    );
}

// Taxa que vale num dia: a última com início até ele, ou a primeira se o dia for anterior a todas.
// Espera `rates` em ordem (como sai de `parseRateChanges`).
export function rateOn(rates: RateEntry[], iso: IsoDate): RateEntry | null {
  let current = rates[0] ?? null;
  for (const rate of rates) {
    if (rate.from <= iso) current = rate;
  }
  return current;
}

// ---------------------------------------------------------------------------
// Rendimento de um dia útil
// ---------------------------------------------------------------------------

// "% do CDI" vale sobre a taxa do dia: cada faixa rende a sua parte do saldo × percentual × CDI diário.
export function tieredDailyYield(balanceCents: number, tiers: RateTier[], cdiDailyFraction: number): number {
  let total = 0;
  let floor = 0;
  for (const tier of tiers) {
    if (balanceCents <= floor) break;
    const ceiling = capOf(tier);
    total += (Math.min(balanceCents, ceiling) - floor) * (tier.ofCdiPercent / 100) * cdiDailyFraction;
    floor = ceiling;
  }
  return total;
}

// Fator diário de uma taxa fixa ao ano, em 252 dias úteis.
export function fixedDailyFactor(annualPercent: number): number {
  return Math.pow(1 + annualPercent / 100, 1 / BUSINESS_DAYS_PER_YEAR) - 1;
}

type CdiCalendar = {
  lastDate: IsoDate | null;
  isCreditDay: (iso: IsoDate) => boolean;
  cdiForCredit: (iso: IsoDate) => number;
};

// Dia útil = o Banco Central publicou CDI para ele. Fora do período publicado (hoje, por exemplo),
// vale segunda a sexta menos feriados nacionais.
function buildCdiCalendar(cdiByDate: Map<IsoDate, number>): CdiCalendar {
  const dates = Array.from(cdiByDate.keys()).sort();
  const firstDate = dates[0] ?? null;
  const lastDate = dates[dates.length - 1] ?? null;

  const isCreditDay = (iso: IsoDate) => {
    if (cdiByDate.has(iso)) return true;
    if (firstDate !== null && lastDate !== null && iso >= firstDate && iso <= lastDate) return false;
    return isBusinessDay(iso);
  };

  // O crédito de um dia usa o CDI do dia útil anterior; se ainda não saiu, o último publicado antes dele.
  const cdiForCredit = (iso: IsoDate) => {
    if (dates.length === 0) return 0;
    const reference = previousBusinessDay(iso);
    const exact = cdiByDate.get(reference);
    if (exact !== undefined) return exact;
    const index = lastIndexAtOrBefore(dates, reference);
    return cdiByDate.get(dates[Math.max(index, 0)]) ?? 0;
  };

  return { lastDate, isCreditDay, cdiForCredit };
}

// Busca binária em datas ordenadas; -1 se todas forem posteriores.
function lastIndexAtOrBefore(sortedDates: IsoDate[], iso: IsoDate): number {
  let low = 0;
  let high = sortedDates.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (sortedDates[middle] <= iso) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

function dailyYield(balanceCents: number, rate: RateEntry | null, calendar: CdiCalendar, day: IsoDate): number {
  if (!rate || balanceCents <= 0) return 0;
  if (rate.mode === "annual") return balanceCents * fixedDailyFactor(rate.annualPercent);
  return tieredDailyYield(balanceCents, rate.tiers, calendar.cdiForCredit(day));
}

// ---------------------------------------------------------------------------
// Simulação dia a dia
// ---------------------------------------------------------------------------

type DayStep = { date: IsoDate; yieldCents: number; balanceCents: number };

function signedAmount(movement: InvestmentMovement): number {
  return movement.kind === "withdrawal" ? -movement.amountCents : movement.amountCents;
}

function sortMovements(movements: InvestmentMovement[], asOf: IsoDate): InvestmentMovement[] {
  return movements
    .filter((movement) => movement.date <= asOf)
    .sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

// Saldo sem arredondar. Em cada dia: primeiro o rendimento (se for dia útil), depois os movimentos;
// por isso um aporte só começa a render no dia útil seguinte.
function* walkDays(
  movements: InvestmentMovement[],
  rates: RateEntry[],
  calendar: CdiCalendar,
  asOf: IsoDate,
): Generator<DayStep> {
  const sorted = sortMovements(movements, asOf);
  if (sorted.length === 0) return;
  let balance = 0;
  let next = 0;
  for (let date = sorted[0].date; date <= asOf; date = addDays(date, 1)) {
    const yieldCents = calendar.isCreditDay(date) ? dailyYield(balance, rateOn(rates, date), calendar, date) : 0;
    balance += yieldCents;
    while (next < sorted.length && sorted[next].date === date) balance += signedAmount(sorted[next++]);
    yield { date, yieldCents, balanceCents: balance };
  }
}

function sumMovements(movements: InvestmentMovement[], asOf: IsoDate, month: string) {
  const totals = { deposited: 0, withdrawn: 0, adjustments: 0, monthAdjustments: 0 };
  for (const movement of movements) {
    if (movement.date > asOf) continue;
    if (movement.kind === "deposit") totals.deposited += movement.amountCents;
    else if (movement.kind === "withdrawal") totals.withdrawn += movement.amountCents;
    else {
      totals.adjustments += movement.amountCents;
      if (movement.date.slice(0, 7) === month) totals.monthAdjustments += movement.amountCents;
    }
  }
  return totals;
}

// Arredonda para exibir; `|| 0` troca -0 por 0 (após "Resgatar tudo" o saldo pode ficar em -0,4 centavo,
// e -0 sairia como "-R$ 0,00").
function roundCents(value: number): number {
  return Math.round(value) || 0;
}

function nextCreditDay(calendar: CdiCalendar, iso: IsoDate): IsoDate {
  let day = addDays(iso, 1);
  while (!calendar.isCreditDay(day)) day = addDays(day, 1);
  return day;
}

export function simulateInvestment({ movements, rates, cdiByDate, asOf, month }: SimulateInvestmentInput): InvestmentSummary {
  const calendar = buildCdiCalendar(cdiByDate);
  const totals = sumMovements(movements, asOf, month);
  let balance = 0;
  let yieldTotal = 0;
  let yieldMonth = 0;
  let yieldToday = 0;
  for (const step of walkDays(movements, rates, calendar, asOf)) {
    balance = step.balanceCents;
    yieldTotal += step.yieldCents;
    if (step.date.slice(0, 7) === month) yieldMonth += step.yieldCents;
    if (step.date === asOf) yieldToday = step.yieldCents;
  }
  const todayIsBusinessDay = calendar.isCreditDay(asOf);
  const creditDay = nextCreditDay(calendar, asOf);

  return {
    valueCents: roundCents(balance),
    depositedCents: totals.deposited,
    withdrawnCents: totals.withdrawn,
    adjustmentsCents: totals.adjustments,
    yieldTodayCents: roundCents(yieldToday),
    todayIsBusinessDay,
    todayReason: todayIsBusinessDay ? null : isWeekend(asOf) ? "weekend" : "holiday",
    yieldMonthCents: roundCents(yieldMonth + totals.monthAdjustments),
    yieldTotalCents: roundCents(yieldTotal + totals.adjustments),
    nextCreditCents: roundCents(dailyYield(balance, rateOn(rates, creditDay), calendar, creditDay)),
    currentRate: rateOn(rates, asOf),
    cdiLastDate: calendar.lastDate,
  };
}

// Primeiro dia em que o saldo fica negativo depois dos movimentos (para barrar resgate, edição ou exclusão).
export function firstOverdrawnDate(
  movements: InvestmentMovement[],
  rates: RateEntry[],
  cdiByDate: Map<IsoDate, number>,
  asOf: IsoDate,
): IsoDate | null {
  const calendar = buildCdiCalendar(cdiByDate);
  for (const step of walkDays(movements, rates, calendar, asOf)) {
    if (step.balanceCents < -OVERDRAWN_TOLERANCE_CENTS) return step.date;
  }
  return null;
}
