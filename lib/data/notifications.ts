import "server-only";

import { getOccurrences } from "@/lib/data/events";
import type { UpcomingBill } from "@/lib/data/finance-family";
import { getUpcomingPersonalBillsFromApi } from "@/lib/integrations/finance-api";
import { addDays, formatOverdue, formatRelativeDay, minutesToTime, todayIso, wallParts } from "@/lib/dates";
import { getFinanceScope } from "@/lib/finance/scope";
import { formatCentsToBrl } from "@/lib/money";
import type { AppNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

const SOON_MIN = 60; // compromissos e tarefas com horário entram em "Agora" até 1 h antes
const MAX_OVERDUE = 12;

export async function getReadKeys(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("settings").maybeSingle();
  const read = (data?.settings as Record<string, unknown> | null)?.notifications_read;
  return Array.isArray(read) ? read.filter((k): k is string => typeof k === "string") : [];
}

// Avisos do sino, montados a partir do que já existe: agenda, tarefas, contas e Caixa de Entrada.
export async function getNotifications(): Promise<AppNotification[]> {
  const now = new Date();
  const today = todayIso(now);

  // Membro das Finanças: só os avisos de contas (o resto não é dele).
  const scope = await getFinanceScope();
  if (scope.isMember) {
    const [bills, readKeys] = await Promise.all([getUpcomingPersonalBillsFromApi(30, 50), getReadKeys()]);
    return withRead(billNotifications(bills, today), readKeys);
  }

  const supabase = await createClient();
  const nowMin = wallParts(now.toISOString()).minutes;

  const [tasksRes, areasRes, foldersRes, inboxRes, events, bills, readKeys] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, area_id, folder_id, due_date, start_time")
      .is("deleted_at", null)
      .in("status", ["todo", "doing", "waiting"])
      .lte("due_date", today)
      .order("due_date")
      .limit(200),
    supabase.from("areas").select("id, name"),
    supabase.from("folders").select("id, name").is("deleted_at", null),
    supabase
      .from("inbox_items")
      .select("id, created_at", { count: "exact" })
      .is("deleted_at", null)
      .eq("status", "new")
      .order("created_at")
      .limit(1),
    getOccurrences(new Date(now.getTime() - 3 * 3_600_000).toISOString(), new Date(now.getTime() + SOON_MIN * 60_000).toISOString()),
    getUpcomingPersonalBillsFromApi(30, 50),
    getReadKeys(),
  ]);

  const areaName = new Map((areasRes.data ?? []).map((a) => [a.id, a.name]));
  const folderName = new Map((foldersRes.data ?? []).map((f) => [f.id, f.name]));
  const placeOf = (t: { area_id: string; folder_id: string | null }) =>
    (t.folder_id && folderName.get(t.folder_id)) || areaName.get(t.area_id) || "";
  const list: Omit<AppNotification, "read">[] = [];

  // Agora: compromissos que começam em até 1 h ou estão acontecendo.
  for (const o of events) {
    if (o.allDay) continue;
    const start = wallParts(o.start);
    const end = wallParts(o.end);
    const startsIn = Math.round((new Date(o.start).getTime() - now.getTime()) / 60_000);
    const running = startsIn <= 0 && new Date(o.end).getTime() > now.getTime();
    if (!running && (startsIn < 0 || startsIn > SOON_MIN)) continue;
    const range = end.date === start.date ? `${minutesToTime(start.minutes)} – ${minutesToTime(end.minutes)}` : minutesToTime(start.minutes);
    list.push({
      key: `event:${o.key}`,
      group: "agora",
      category: "agenda",
      tone: "blue",
      icon: "calendar",
      title: running ? `${o.title} está acontecendo` : startsIn <= 1 ? `${o.title} começa agora` : `${o.title} começa em ${startsIn} min`,
      detail: [range, o.location].filter(Boolean).join(" · "),
      time: minutesToTime(start.minutes),
      href: "/agenda?v=dia",
    });
  }

  const tasks = tasksRes.data ?? [];

  // Agora: tarefas de hoje com horário que já chegou ou chega em até 1 h.
  for (const t of tasks) {
    if (t.due_date !== today || !t.start_time) continue;
    const [h, m] = t.start_time.split(":").map(Number);
    const at = h * 60 + m;
    if (at - nowMin > SOON_MIN) continue;
    const time = minutesToTime(at);
    list.push({
      key: `task-time:${t.id}:${today}`,
      group: "agora",
      category: "tarefas",
      tone: "blue",
      icon: "clock",
      title: t.title,
      detail: [at <= nowMin ? `Era às ${time}` : `Às ${time}`, placeOf(t)].filter(Boolean).join(" · "),
      time,
      href: `/hoje?tarefa=${t.id}`,
      action: { type: "complete", taskId: t.id },
    });
  }

  // Hoje: tarefas atrasadas, uma por uma (as mais antigas primeiro).
  for (const t of tasks.filter((x) => x.due_date && x.due_date < today).slice(0, MAX_OVERDUE)) {
    list.push({
      key: `task-overdue:${t.id}:${t.due_date}`,
      group: "hoje",
      category: "tarefas",
      tone: "red",
      icon: "alert",
      title: t.title,
      urgent: `Atrasada ${formatOverdue(t.due_date!, today)}`,
      detail: placeOf(t),
      time: formatRelativeDay(t.due_date!, today),
      href: `/hoje?tarefa=${t.id}`,
      action: { type: "move-today", taskId: t.id, previousDue: t.due_date },
    });
  }

  // Hoje: contas atrasadas ou que vencem hoje/amanhã.
  list.push(...billNotifications(bills, today));

  // Caixa de Entrada: um aviso só, com a contagem (muda a chave quando chega item novo).
  const inboxCount = inboxRes.count ?? 0;
  if (inboxCount > 0) {
    const oldest = inboxRes.data?.[0]?.created_at;
    const oldestDay = oldest ? todayIso(new Date(oldest)) : today;
    list.push({
      key: `inbox:${inboxCount}:${inboxRes.data?.[0]?.id ?? ""}`,
      group: oldestDay < today ? "anteriores" : "hoje",
      category: "entrada",
      tone: "gray",
      icon: "inbox",
      title: inboxCount === 1 ? "1 item na Caixa de Entrada" : `${inboxCount} itens na Caixa de Entrada`,
      detail: "Esperando para ir para uma pasta",
      time: formatRelativeDay(oldestDay, today),
      href: "/entrada",
    });
  }

  return withRead(list, readKeys);
}

function withRead(list: Omit<AppNotification, "read">[], readKeys: string[]): AppNotification[] {
  const read = new Set(readKeys);
  return list.map((n) => ({ ...n, read: read.has(n.key) }));
}

// Contas atrasadas ou que vencem hoje/amanhã.
function billNotifications(bills: UpcomingBill[], today: string): Omit<AppNotification, "read">[] {
  const tomorrow = addDays(today, 1);
  return bills
    .filter((b) => b.due_date && b.due_date <= tomorrow)
    .map((b): Omit<AppNotification, "read"> => {
      const due = b.due_date!;
      const overdue = b.billStatus === "overdue";
      return {
        key: `bill:${b.id}:${due}`,
        group: "hoje",
        category: "financas",
        tone: overdue ? "red" : "amber",
        icon: "wallet",
        title: overdue ? `${b.description} está atrasada` : `${b.description} vence ${due === today ? "hoje" : "amanhã"}`,
        urgent: overdue ? `Venceu ${formatRelativeDay(due, today)}` : undefined,
        detail: [formatCentsToBrl(b.amount_cents), b.member_label].filter(Boolean).join(" · "),
        time: formatRelativeDay(due, today),
        href: "/financas?ledger=pessoal&tab=fluxo",
        action: { type: "pay", transactionId: b.id },
      };
    });
}
