// Todas as datas aparecem no horário de Cuiabá, não no do servidor (que roda em UTC).
// Datas "de calendário" (prazo de tarefa, dia de hábito) circulam como texto ISO "AAAA-MM-DD".
export const TIME_ZONE = "America/Cuiaba";
// Cuiabá está em UTC-4 o ano todo (sem horário de verão desde 2019).
export const TZ_OFFSET = "-04:00";
export const TZ_OFFSET_MS = -4 * 60 * 60 * 1000;

const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: TIME_ZONE });
const shortDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: TIME_ZONE });
const isoInZone = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });

// "Sábado, 31 de outubro de 2026"
export function formatLongDate(date: Date) {
  const text = longDate.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "31/10/2026, 18:40"
export function formatDateTime(date: Date | string) {
  return shortDateTime.format(typeof date === "string" ? new Date(date) : date);
}

// ---------------------------------------------------------------------------
// Datas de calendário (sem hora)
// ---------------------------------------------------------------------------

export type IsoDate = string;

// Hoje em Cuiabá, como "AAAA-MM-DD".
export function todayIso(now = new Date()): IsoDate {
  return isoInZone.format(now);
}

function toUtc(iso: IsoDate) {
  return new Date(`${iso}T00:00:00Z`);
}

function fromUtc(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

// Soma meses mantendo o dia (31/jan + 1 mês = 28 ou 29/fev).
export function addMonths(iso: IsoDate, months: number): IsoDate {
  const d = toUtc(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtc(d);
}

// 0 = domingo … 6 = sábado
export function weekday(iso: IsoDate) {
  return toUtc(iso).getUTCDay();
}

// A semana começa na segunda-feira.
export function startOfWeek(iso: IsoDate): IsoDate {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}

export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: IsoDate): IsoDate {
  return addDays(addMonths(startOfMonth(iso), 1), -1);
}

export function daysBetween(from: IsoDate, to: IsoDate) {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

const weekdayShort = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });
const dayMonthYear = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

// "20 de nov." → "20 nov"
const clean = (s: string) => s.replace(/\./g, "").replace(/ de /g, " ");

// "hoje", "amanhã", "ontem", "seg, 3 nov", "3 nov 2027"
export function formatRelativeDay(iso: IsoDate, today = todayIso()) {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "hoje";
  if (diff === 1) return "amanhã";
  if (diff === -1) return "ontem";
  const d = toUtc(iso);
  if (iso.slice(0, 4) !== today.slice(0, 4)) return clean(dayMonthYear.format(d));
  if (diff > 1 && diff < 7) return clean(weekdayShort.format(d));
  return `${clean(weekdayShort.format(d))}, ${clean(dayMonth.format(d))}`;
}

// "26 out"
export function formatShortDate(iso: IsoDate) {
  return clean(dayMonth.format(toUtc(iso)));
}

// "seg", "ter"…
export function formatWeekdayShort(iso: IsoDate) {
  return clean(weekdayShort.format(toUtc(iso)));
}

// "novembro de 2026"
export function formatMonthYear(iso: IsoDate) {
  return monthYear.format(toUtc(iso));
}

// Data e minuto do dia (0–1439) de um instante, no relógio de Cuiabá.
export function wallParts(iso: string) {
  const d = new Date(new Date(iso).getTime() + TZ_OFFSET_MS);
  return { date: d.toISOString().slice(0, 10) as IsoDate, minutes: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

// Instante (ISO) a partir de data + minuto do dia em Cuiabá.
export function fromWallParts(date: IsoDate, minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:00${TZ_OFFSET}`).toISOString();
}

// "08:30" a partir de minutos do dia
export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// "08:30" a partir de "08:30:00"
export function formatTime(time: string | null | undefined) {
  return time ? time.slice(0, 5) : "";
}
