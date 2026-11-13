import "server-only";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { addDays, todayIso, type IsoDate } from "@/lib/dates";
import { isBusinessDay, previousBusinessDay } from "@/lib/finance/business-days";
import { BUSINESS_DAYS_PER_YEAR } from "@/lib/finance/investments";
import type { CdiInfo } from "@/lib/finance/investments-data";
import { createClient } from "@/lib/supabase/server";

// CDI diário (série 12 do Banco Central), com cópia em `finance_cdi_daily`.
// A pergunta ao Banco Central é um GET público só com datas: nenhum dado do Luan sai daqui.

const BCB_CDI_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados";
const FETCH_TIMEOUT_MS = 5_000;
// Folga antes de `fromIso`, para sempre haver um dia com CDI guardado antes do período pedido.
const LOOKBACK_DAYS = 7;
// Com a cópia em dia até anteontem (o CDI de ontem às vezes ainda não saiu), pergunta de novo só depois disso.
const RECHECK_AFTER_MS = 30 * 60 * 1000;
// Depois de uma falha, não tenta de novo por um tempo, para não atrasar cada página em 5 s.
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000;
const PAGE_SIZE = 1000;

let lastFailureAt = 0;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type StoredRow = { date: IsoDate; daily_percent: number; fetched_at: string };
type CdiPoint = { date: IsoDate; dailyPercent: number };
type CoverageGap = "none" | "tail" | "full";

export type CdiSeries = {
  // CDI diário em fração (0,050788% → 0.00050788), como `simulateInvestment` espera.
  cdiByDate: Map<IsoDate, number>;
  info: CdiInfo;
};

const bcbResponseSchema = z.array(
  z.object({
    data: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
    valor: z.string().regex(/^\d+(\.\d+)?$/),
  }),
);

// ---------------------------------------------------------------------------
// Cópia guardada
// ---------------------------------------------------------------------------

async function readStoredRows(supabase: SupabaseClient, userId: string, fromIso: IsoDate): Promise<StoredRow[]> {
  const rows: StoredRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("finance_cdi_daily")
      .select("date, daily_percent, fetched_at")
      .eq("user_id", userId)
      .gte("date", fromIso)
      .order("date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data.map((row) => ({ ...row, daily_percent: Number(row.daily_percent) })));
    if (data.length < PAGE_SIZE) return rows;
  }
}

async function saveRows(supabase: SupabaseClient, userId: string, points: CdiPoint[]) {
  const fetchedAt = new Date().toISOString();
  const { error } = await supabase.from("finance_cdi_daily").upsert(
    points.map((point) => ({
      user_id: userId,
      date: point.date,
      daily_percent: point.dailyPercent,
      fetched_at: fetchedAt,
    })),
    { onConflict: "user_id,date" },
  );
  if (error) console.error("getCdiSeries: não foi possível guardar o CDI:", error);
}

function hasBusinessDayBetween(after: IsoDate, before: IsoDate): boolean {
  for (let day = addDays(after, 1); day < before; day = addDays(day, 1)) {
    if (isBusinessDay(day)) return true;
  }
  return false;
}

// Um dia útil sem CDI dentro da cópia viraria "não rende", então a cópia não pode ter buracos.
// Linhas da mesma busca têm o mesmo fetched_at e vieram em sequência do Banco Central: entre elas não há buraco
// (um feriado que o calendário local não conhece não conta). Buraco = dia útil faltando entre buscas diferentes.
function hasHole(rows: StoredRow[]): boolean {
  return rows.some((row, index) => {
    const previous = rows[index - 1];
    return previous !== undefined && previous.fetched_at !== row.fetched_at && hasBusinessDayBetween(previous.date, row.date);
  });
}

function findCoverageGap(rows: StoredRow[], fromIso: IsoDate, today: IsoDate): CoverageGap {
  if (rows.length === 0 || rows[0].date > fromIso || hasHole(rows)) return "full";
  return rows[rows.length - 1].date < previousBusinessDay(today) ? "tail" : "none";
}

function lastFetchedAt(rows: StoredRow[]): number {
  return rows.reduce((latest, row) => Math.max(latest, Date.parse(row.fetched_at) || 0), 0);
}

// ---------------------------------------------------------------------------
// Banco Central
// ---------------------------------------------------------------------------

// "2026-11-12" → "12/11/2026" e vice-versa.
const toBcbDate = (iso: IsoDate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const fromBcbDate = (text: string): IsoDate => `${text.slice(6, 10)}-${text.slice(3, 5)}-${text.slice(0, 2)}`;

async function fetchBcbSeries(from: IsoDate, to: IsoDate): Promise<CdiPoint[]> {
  const params = new URLSearchParams({ formato: "json", dataInicial: toBcbDate(from), dataFinal: toBcbDate(to) });
  // O app guarda a própria cópia, então o fetch não usa o cache do Next. O signal também tira a memoização.
  const response = await fetch(`${BCB_CDI_URL}?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Banco Central respondeu ${response.status}`);
  const parsed = bcbResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("Resposta do Banco Central em formato inesperado");
  return parsed.data.map((item) => ({ date: fromBcbDate(item.data), dailyPercent: Number(item.valor) }));
}

// ---------------------------------------------------------------------------
// Série para o cálculo
// ---------------------------------------------------------------------------

function annualFromDaily(dailyPercent: number): number {
  return (Math.pow(1 + dailyPercent / 100, BUSINESS_DAYS_PER_YEAR) - 1) * 100;
}

function buildSeries(percentByDate: Map<IsoDate, number>, stale: boolean): CdiSeries {
  const dates = Array.from(percentByDate.keys()).sort();
  const lastDate = dates[dates.length - 1] ?? null;
  const dailyPercent = lastDate ? (percentByDate.get(lastDate) ?? null) : null;
  const cdiByDate = new Map(dates.map((date) => [date, percentByDate.get(date)! / 100]));
  return {
    cdiByDate,
    info: {
      lastDate,
      dailyPercent,
      annualPercent: dailyPercent === null ? null : annualFromDaily(dailyPercent),
      stale,
    },
  };
}

// Busca no Banco Central o que falta e grava. Devolve null se não deu (e registra o erro).
async function refreshFromBcb(
  supabase: SupabaseClient,
  userId: string,
  range: { from: IsoDate; to: IsoDate },
): Promise<CdiPoint[] | null> {
  try {
    const points = await fetchBcbSeries(range.from, range.to);
    if (points.length > 0) await saveRows(supabase, userId, points);
    return points;
  } catch (error) {
    lastFailureAt = Date.now();
    console.error("getCdiSeries: falha ao buscar o CDI no Banco Central:", error);
    return null;
  }
}

// CDI de `fromIso` (com uma folga antes) até o último dia publicado. Só pergunta ao Banco Central
// quando a cópia guardada não cobre o período ou está atrasada; em falha, usa a cópia com `stale: true`.
export async function getCdiSeries(fromIso: IsoDate): Promise<CdiSeries> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const today = todayIso();
  const windowStart = addDays(fromIso, -LOOKBACK_DAYS);
  const rows = await readStoredRows(supabase, user.id, windowStart);
  const percentByDate = new Map(rows.map((row) => [row.date, row.daily_percent]));

  const gap = findCoverageGap(rows, fromIso, today);
  if (gap === "none") return buildSeries(percentByDate, false);
  if (Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS) return buildSeries(percentByDate, true);
  if (gap === "tail" && Date.now() - lastFetchedAt(rows) < RECHECK_AFTER_MS) return buildSeries(percentByDate, false);

  // "tail" continua da última linha guardada (inclusive), para a cópia seguir sem buraco.
  const from = gap === "tail" ? rows[rows.length - 1].date : windowStart;
  const points = await refreshFromBcb(supabase, user.id, { from, to: today });
  if (!points) return buildSeries(percentByDate, true);
  for (const point of points) percentByDate.set(point.date, point.dailyPercent);
  return buildSeries(percentByDate, false);
}
