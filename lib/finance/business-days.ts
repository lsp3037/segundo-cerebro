// Dias úteis bancários (feriados nacionais), para os dias que o Banco Central ainda não publicou.
// Fica fora de arquivos "use client"/"server-only" porque tela e servidor usam.

import { addDays, weekday, type IsoDate } from "@/lib/dates";

const FIXED_HOLIDAYS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "12-25"];
// Consciência Negra virou feriado nacional em 2024 (Lei 14.759/2023).
const BLACK_CONSCIOUSNESS_FROM_YEAR = 2024;
// Distância em dias a partir do domingo de Páscoa.
const EASTER_OFFSETS = [-48, -47, -2, 60]; // Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi

const holidayCache = new Map<number, Set<IsoDate>>();

// Domingo de Páscoa pelo algoritmo gregoriano (Meeus/Jones/Butcher).
function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function brazilHolidays(year: number): Set<IsoDate> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const holidays = new Set<IsoDate>(FIXED_HOLIDAYS.map((monthDay) => `${year}-${monthDay}`));
  if (year >= BLACK_CONSCIOUSNESS_FROM_YEAR) holidays.add(`${year}-11-20`);
  const easter = easterSunday(year);
  for (const offset of EASTER_OFFSETS) holidays.add(addDays(easter, offset));
  holidayCache.set(year, holidays);
  return holidays;
}

export function isWeekend(iso: IsoDate): boolean {
  const day = weekday(iso);
  return day === 0 || day === 6;
}

export function isBusinessDay(iso: IsoDate): boolean {
  return !isWeekend(iso) && !brazilHolidays(Number(iso.slice(0, 4))).has(iso);
}

// Dia útil estritamente anterior.
export function previousBusinessDay(iso: IsoDate): IsoDate {
  let day = addDays(iso, -1);
  while (!isBusinessDay(day)) day = addDays(day, -1);
  return day;
}

// Dia útil estritamente posterior.
export function nextBusinessDay(iso: IsoDate): IsoDate {
  let day = addDays(iso, 1);
  while (!isBusinessDay(day)) day = addDays(day, 1);
  return day;
}
