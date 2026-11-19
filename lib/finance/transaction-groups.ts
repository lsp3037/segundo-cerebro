// Regras puras da lista de Lançamentos: grupos, totais do mês, situação de cada linha e contagens.
// Sem "use client" e sem "server-only": serve tanto para a tela quanto para testes.
import {
  addDays,
  daysBetween,
  formatDayTitle,
  formatMonthName,
  formatWeekdayLong,
  startOfWeek,
  type IsoDate,
} from "@/lib/dates";
import type { Transaction } from "@/lib/data/finance";
import type {
  IsPaidFn,
  MonthTotals,
  TotalsPart,
  TxGroup,
  TxGroups,
  TxSituation,
} from "./transaction-groups.types";

const RECENT_DAYS = 7; // hoje e os 6 dias anteriores viram um grupo por dia
const SOON_DAYS = 7; // até 7 dias à frente o vencimento aparece em amarelo

const isIncome = (tx: Transaction) => tx.kind === "income";
const dueKey = (tx: Transaction): IsoDate => tx.due_date ?? tx.date;
const doneKey = (tx: Transaction): IsoDate => (tx.paid_at || tx.date).slice(0, 10);

const byDescription = (a: Transaction, b: Transaction) => a.description.localeCompare(b.description, "pt-BR");
const byDueThenDescription = (a: Transaction, b: Transaction) =>
  dueKey(a).localeCompare(dueKey(b)) || byDescription(a, b);
const byPaidDescThenDescription = (a: Transaction, b: Transaction) =>
  doneKey(b).localeCompare(doneKey(a)) || byDescription(a, b);

function mergeUnique(transactions: Transaction[], overdueEarlier: Transaction[]) {
  const seen = new Set<string>();
  return [...transactions, ...overdueEarlier].filter((tx) => {
    if (seen.has(tx.id)) return false;
    seen.add(tx.id);
    return true;
  });
}

function sums(items: Transaction[]) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const tx of items) {
    if (isIncome(tx)) incomeCents += tx.amount_cents;
    else expenseCents += tx.amount_cents;
  }
  return { incomeCents, expenseCents };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// "2 contas" quando só há saídas; "3 itens" quando há entradas.
function countLabel(items: Transaction[]) {
  return items.some(isIncome) ? plural(items.length, "item", "itens") : plural(items.length, "conta", "contas");
}

const dayNumber = (iso: IsoDate) => Number(iso.slice(8, 10));
const shortBr = (iso: IsoDate) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const weekdayName = (iso: IsoDate) => formatWeekdayLong(iso).replace(/-feira$/, "");

// "20 a 22 de novembro" ou, virando o mês, "30 de novembro a 2 de dezembro".
function formatRange(from: IsoDate, to: IsoDate) {
  if (from === to) return `${dayNumber(to)} de ${formatMonthName(to)}`;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${dayNumber(from)} a ${dayNumber(to)} de ${formatMonthName(to)}`;
  return `${dayNumber(from)} de ${formatMonthName(from)} a ${dayNumber(to)} de ${formatMonthName(to)}`;
}

function makeGroup(
  group: Pick<TxGroup, "id" | "section" | "title"> & { tone?: TxGroup["tone"]; subtitle: string | null },
  items: Transaction[]
): TxGroup {
  return { tone: "normal", ...group, items, ...sums(items) };
}

function buildTodoGroups(items: Transaction[], today: IsoDate): TxGroup[] {
  const weekEnd = addDays(startOfWeek(today), 6);
  const overdue: Transaction[] = [];
  const noDue: Transaction[] = [];
  const week: Transaction[] = [];
  const later: Transaction[] = [];

  for (const tx of items) {
    const key = dueKey(tx);
    if (tx.due_date && tx.due_date < today) overdue.push(tx);
    else if (!tx.due_date && key < today) noDue.push(tx);
    else if (key <= weekEnd) week.push(tx);
    else later.push(tx);
  }

  const sorted = (list: Transaction[]) => [...list].sort(byDueThenDescription);
  const groups: TxGroup[] = [];

  if (overdue.length) {
    const list = sorted(overdue);
    groups.push(makeGroup({ id: "overdue", section: "todo", tone: "late", title: "Atrasado", subtitle: countLabel(list) }, list));
  }
  if (week.length) {
    const list = sorted(week);
    const subtitle = `${formatRange(dueKey(list[0]), weekEnd)} · ${countLabel(list)}`;
    groups.push(makeGroup({ id: "week", section: "todo", title: "Esta semana", subtitle }, list));
  }
  if (later.length) {
    const list = sorted(later);
    const subtitle = `até ${dayNumber(dueKey(list[list.length - 1]))} de ${formatMonthName(dueKey(list[list.length - 1]))} · ${countLabel(list)}`;
    groups.push(makeGroup({ id: "later", section: "todo", title: "Mais adiante", subtitle }, list));
  }
  if (noDue.length) {
    const list = [...noDue].sort(byDescription);
    groups.push(makeGroup({ id: "nodue", section: "todo", title: "Sem vencimento", subtitle: countLabel(list) }, list));
  }
  return groups;
}

function doneBucket(date: IsoDate, today: IsoDate) {
  if (date > addDays(today, -RECENT_DAYS)) return { id: `day:${date}`, sortKey: date };
  const month = date.slice(0, 7);
  return { id: `month:${month}`, sortKey: `${month}-01` };
}

function doneSubtitle(id: string, items: Transaction[], today: IsoDate) {
  const count = plural(items.length, "item", "itens");
  if (!id.startsWith("day:")) return count;
  const diff = daysBetween(today, id.slice(4));
  if (diff === 0) return `hoje · ${count}`;
  if (diff === -1) return `ontem · ${count}`;
  return count;
}

function doneTitle(id: string, today: IsoDate) {
  if (id.startsWith("day:")) return formatDayTitle(id.slice(4));
  const month = `${id.slice(6)}-01`;
  const sameYear = month.slice(0, 4) === today.slice(0, 4);
  return `Antes, em ${formatMonthName(month)}${sameYear ? "" : ` de ${month.slice(0, 4)}`}`;
}

function buildDoneGroups(items: Transaction[], today: IsoDate): TxGroup[] {
  const buckets = new Map<string, { sortKey: string; items: Transaction[] }>();
  for (const tx of items) {
    const { id, sortKey } = doneBucket(doneKey(tx), today);
    const bucket = buckets.get(id) ?? { sortKey, items: [] };
    bucket.items.push(tx);
    buckets.set(id, bucket);
  }
  return [...buckets.entries()]
    .sort(([, a], [, b]) => b.sortKey.localeCompare(a.sortKey))
    .map(([id, { items: list }]) =>
      makeGroup(
        { id, section: "done", title: doneTitle(id, today), subtitle: doneSubtitle(id, list, today) },
        [...list].sort(byPaidDescThenDescription)
      )
    );
}

export function buildTxGroups(params: {
  transactions: Transaction[];
  overdueEarlier: Transaction[];
  today: IsoDate;
  isPaid: IsPaidFn;
}): TxGroups {
  const all = mergeUnique(params.transactions, params.overdueEarlier);
  return {
    todo: buildTodoGroups(all.filter((tx) => !params.isPaid(tx)), params.today),
    done: buildDoneGroups(all.filter(params.isPaid), params.today),
  };
}

function totalsPart(items: Transaction[], isPaid: IsPaidFn): TotalsPart {
  let totalCents = 0;
  let doneCents = 0;
  let pendingCount = 0;
  for (const tx of items) {
    totalCents += tx.amount_cents;
    if (isPaid(tx)) doneCents += tx.amount_cents;
    else pendingCount += 1;
  }
  return { totalCents, doneCents, pendingCents: totalCents - doneCents, pendingCount };
}

export function monthTotals(params: { transactions: Transaction[]; isPaid: IsPaidFn }): MonthTotals {
  const income = totalsPart(params.transactions.filter(isIncome), params.isPaid);
  const expense = totalsPart(params.transactions.filter((tx) => !isIncome(tx)), params.isPaid);
  return {
    income,
    expense,
    netCents: income.totalCents - expense.totalCents,
    inHandCents: income.doneCents - expense.doneCents,
  };
}

function paidSituation(tx: Transaction, today: IsoDate): TxSituation {
  const date = doneKey(tx);
  const when = date === today ? "hoje" : `em ${shortBr(date)}`;
  return isIncome(tx) ? { text: `Recebido ${when}`, tone: "in" } : { text: `Pago ${when}`, tone: "mute" };
}

function overdueSituation(tx: Transaction, due: IsoDate, today: IsoDate): TxSituation {
  const days = daysBetween(due, today);
  if (isIncome(tx)) return { text: `Atrasado desde ${shortBr(due)}, ${plural(days, "dia", "dias")}`, tone: "late" };
  return { text: `Venceu em ${shortBr(due)}, ${plural(days, "dia", "dias")} de atraso`, tone: "late" };
}

function upcomingSituation(tx: Transaction, due: IsoDate, today: IsoDate): TxSituation {
  const diff = daysBetween(today, due);
  const verb = isIncome(tx) ? "A receber" : "Vence";
  if (diff > SOON_DAYS) return { text: `${verb} em ${shortBr(due)}`, tone: "mute" };
  if (diff === 0) return { text: isIncome(tx) ? "A receber hoje" : "Vence hoje", tone: "soon" };
  if (diff === 1) {
    const text = isIncome(tx) ? "A receber amanhã" : `Vence amanhã, ${weekdayName(due)} (${shortBr(due)})`;
    return { text, tone: "soon" };
  }
  return { text: `${verb} ${weekdayName(due)} (${shortBr(due)})`, tone: "soon" };
}

export function txSituation(tx: Transaction, paid: boolean, today: IsoDate): TxSituation {
  if (paid) return paidSituation(tx, today);
  const due = dueKey(tx);
  if (!tx.due_date && due < today) return { text: isIncome(tx) ? "A receber" : "A pagar", tone: "mute" };
  if (due < today) return overdueSituation(tx, due, today);
  return upcomingSituation(tx, due, today);
}

export function statusCounts(params: {
  transactions: Transaction[];
  overdueEarlier: Transaction[];
  isPaid: IsPaidFn;
}): { todo: number; done: number; all: number } {
  const all = mergeUnique(params.transactions, params.overdueEarlier);
  const done = all.filter(params.isPaid).length;
  return { todo: all.length - done, done, all: all.length };
}
