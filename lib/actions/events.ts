"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { TZ_OFFSET } from "@/lib/dates";
import { deleteEvent as gDelete, insertEvent, patchEvent, revokeToken } from "@/lib/google/api";
import { decrypt } from "@/lib/google/crypto";
import { ensureWatch, eventRowToGoogle, getAccessToken, saveGoogleEvent, stopWatch, syncCalendar } from "@/lib/google/sync";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const id = z.uuid();
const rules = RECURRENCE_OPTIONS.map((o) => o.value).filter(Boolean) as [string, ...string[]];

const eventFields = z.object({
  calendar_id: id,
  area_id: id.nullable(),
  title: z.string().trim().min(1, "Dê um título ao evento.").max(500),
  description: z.string().max(8000).nullable(),
  location: z.string().max(500).nullable(),
  start_at: z.iso.datetime({ offset: true }),
  end_at: z.iso.datetime({ offset: true }),
  all_day: z.boolean(),
  recurrence_rule: z.enum(rules).nullable(),
});

export type EventInput = z.input<typeof eventFields>;

// Agenda do usuário (pelo RLS) + cliente admin para os tokens do Google.
async function loadCalendar(calendarId: string) {
  const supabase = await createClient();
  const { data: cal } = await supabase.from("calendars").select("*").eq("id", calendarId).single();
  if (!cal) throw new Error("Agenda não encontrada.");
  if (cal.access_role && !["owner", "writer"].includes(cal.access_role)) {
    throw new Error("Esta agenda é só de leitura no Google.");
  }
  return cal;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erro ao falar com o Google Agenda.";
}

export async function createEvent(input: EventInput): Promise<ActionResult<Tables<"events">>> {
  await getCurrentUser();
  const parsed = eventFields.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  if (data.end_at < data.start_at) return fail("O fim precisa ser depois do início.");

  try {
    const cal = await loadCalendar(data.calendar_id);
    const admin = createAdminClient();
    const token = await getAccessToken(admin, cal.connection_id);
    const created = await insertEvent(
      token,
      cal.google_calendar_id,
      eventRowToGoogle({ ...data, recurrence: data.recurrence_rule ? [`RRULE:${data.recurrence_rule}`] : null }),
    );
    const row = await saveGoogleEvent(admin, cal, created, {
      kind: data.recurrence_rule ? "routine" : "event",
      area_id: data.area_id ?? cal.default_area_id,
    });
    revalidatePath("/agenda");
    return ok(row);
  } catch (error) {
    return fail(message(error));
  }
}

export async function updateEvent(eventId: string, input: Partial<EventInput>): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = eventFields.partial().safeParse(input);
  if (!id.safeParse(eventId).success || !parsed.success) return fail(parsed.error?.issues[0].message ?? "Evento inválido.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!current) return fail("Evento não encontrado.");

  // Trocar a agenda de um evento existente não é suportado; o campo é ignorado.
  const { recurrence_rule, ...rest } = parsed.data;
  delete rest.calendar_id;
  const next = {
    ...current,
    ...rest,
    ...(recurrence_rule !== undefined ? { recurrence: recurrence_rule ? [`RRULE:${recurrence_rule}`] : null } : {}),
  };
  if (next.end_at < next.start_at) return fail("O fim precisa ser depois do início.");

  try {
    if (current.calendar_id && current.google_event_id) {
      const cal = await loadCalendar(current.calendar_id);
      const admin = createAdminClient();
      const token = await getAccessToken(admin, cal.connection_id);
      const patched = await patchEvent(token, cal.google_calendar_id, current.google_event_id, eventRowToGoogle(next));
      await saveGoogleEvent(admin, cal, patched, { kind: current.kind, area_id: next.area_id });
    } else {
      await supabase.from("events").update({ ...rest, local_updated_at: new Date().toISOString() }).eq("id", eventId);
    }
    revalidatePath("/agenda");
    return ok();
  } catch (error) {
    return fail(message(error));
  }
}

export async function removeEvent(eventId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(eventId).success) return fail("Evento inválido.");

  const supabase = await createClient();
  const { data: current } = await supabase.from("events").select("*").eq("id", eventId).single();
  if (!current) return fail("Evento não encontrado.");

  try {
    if (current.calendar_id && current.google_event_id) {
      const cal = await loadCalendar(current.calendar_id);
      const token = await getAccessToken(createAdminClient(), cal.connection_id);
      await gDelete(token, cal.google_calendar_id, current.google_event_id);
    }
    await supabase.from("events").delete().eq("id", eventId);
    revalidatePath("/", "layout");
    return ok();
  } catch (error) {
    return fail(message(error));
  }
}

// ---------------------------------------------------------------------------
// Tarefa com horário → bloco de tempo na agenda
// ---------------------------------------------------------------------------

function taskTimes(task: Tables<"tasks">) {
  const start = new Date(`${task.due_date}T${task.start_time!.slice(0, 5)}:00${TZ_OFFSET}`);
  const end = new Date(start.getTime() + (task.duration_min ?? 30) * 60_000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

// Agenda padrão para os blocos: a principal ligada cuja área bate com a da tarefa (ou qualquer principal ligada).
async function defaultCalendarFor(areaId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("calendars").select("*").eq("sync_enabled", true).order("is_primary", { ascending: false });
  const writable = (data ?? []).filter((c) => !c.access_role || ["owner", "writer"].includes(c.access_role));
  return writable.find((c) => c.default_area_id === areaId && c.is_primary) ?? writable.find((c) => c.is_primary) ?? writable[0] ?? null;
}

export async function scheduleTaskBlock(taskId: string): Promise<ActionResult<{ eventId: string }>> {
  await getCurrentUser();
  if (!id.safeParse(taskId).success) return fail("Tarefa inválida.");

  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!task) return fail("Tarefa não encontrada.");
  if (!task.due_date || !task.start_time) return fail("Defina data e horário antes de enviar para a agenda.");
  if (task.event_id) return ok({ eventId: task.event_id });

  const cal = await defaultCalendarFor(task.area_id);
  if (!cal) return fail("Conecte uma agenda do Google em Configurações.");

  try {
    const admin = createAdminClient();
    const token = await getAccessToken(admin, cal.connection_id);
    const created = await insertEvent(
      token,
      cal.google_calendar_id,
      eventRowToGoogle({ title: task.title, description: task.notes, location: null, ...taskTimes(task), all_day: false, recurrence: null }),
    );
    const row = await saveGoogleEvent(admin, cal, created, { kind: "task_block", area_id: task.area_id });
    await supabase.from("tasks").update({ event_id: row.id }).eq("id", taskId);
    revalidatePath("/", "layout");
    return ok({ eventId: row.id });
  } catch (error) {
    return fail(message(error));
  }
}

// Mantém o bloco igual à tarefa depois de mudar título, data, horário ou duração.
export async function syncTaskBlock(taskId: string): Promise<ActionResult> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!task?.event_id) return ok();
  if (!task.due_date || !task.start_time) return unscheduleTaskBlock(taskId);
  return updateEvent(task.event_id, { title: task.title, ...taskTimes(task), all_day: false });
}

export async function unscheduleTaskBlock(taskId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(taskId).success) return fail("Tarefa inválida.");
  const supabase = await createClient();
  const { data: task } = await supabase.from("tasks").select("event_id").eq("id", taskId).single();
  if (!task?.event_id) return ok();
  const removed = await removeEvent(task.event_id);
  if (!removed.ok) return removed;
  await supabase.from("tasks").update({ event_id: null }).eq("id", taskId);
  return ok();
}

// ---------------------------------------------------------------------------
// Configurações das agendas
// ---------------------------------------------------------------------------

export async function setCalendarSync(calendarId: string, enabled: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!id.safeParse(calendarId).success) return fail("Agenda inválida.");

  const admin = createAdminClient();
  const { data: cal } = await admin.from("calendars").select("*").eq("id", calendarId).eq("user_id", user.id).single();
  if (!cal) return fail("Agenda não encontrada.");

  await admin.from("calendars").update({ sync_enabled: enabled, ...(enabled ? {} : { sync_token: null }) }).eq("id", calendarId);

  if (enabled) {
    after(async () => {
      try {
        await syncCalendar(admin, { ...cal, sync_enabled: true, sync_token: null });
        await ensureWatch(admin, cal);
      } catch (e) {
        console.error("ativar agenda", calendarId, e);
      }
    });
  } else {
    await stopWatch(admin, cal);
    // Eventos de agenda desligada saem do app (continuam no Google).
    await admin.from("events").delete().eq("calendar_id", calendarId);
  }

  revalidatePath("/", "layout");
  return ok();
}

export async function setCalendarArea(calendarId: string, areaId: string | null): Promise<ActionResult> {
  await getCurrentUser();
  if (!id.safeParse(calendarId).success || (areaId && !id.safeParse(areaId).success)) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("calendars").update({ default_area_id: areaId }).eq("id", calendarId);
  if (error) return fail("Não foi possível salvar.");
  revalidatePath("/", "layout");
  return ok();
}

export async function syncNow(): Promise<ActionResult<{ calendars: number; errors: number }>> {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { data: calendars } = await admin.from("calendars").select("*").eq("user_id", user.id).eq("sync_enabled", true);

  let errors = 0;
  for (const cal of calendars ?? []) {
    try {
      await syncCalendar(admin, cal);
      await ensureWatch(admin, cal);
    } catch (e) {
      errors++;
      console.error("sincronizar agora", cal.id, e);
    }
  }
  revalidatePath("/", "layout");
  return ok({ calendars: calendars?.length ?? 0, errors });
}

export async function disconnectGoogle(connectionId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!id.safeParse(connectionId).success) return fail("Conexão inválida.");

  const admin = createAdminClient();
  const { data: conn } = await admin.from("google_connections").select("*").eq("id", connectionId).eq("user_id", user.id).single();
  if (!conn) return fail("Conexão não encontrada.");

  const { data: calendars } = await admin.from("calendars").select("*").eq("connection_id", connectionId);
  for (const cal of calendars ?? []) await stopWatch(admin, cal);
  await revokeToken(decrypt(conn.refresh_token_enc));
  // Apaga a conexão; agendas e eventos dela saem junto (os do Google continuam lá).
  await admin.from("google_connections").delete().eq("id", connectionId);

  revalidatePath("/", "layout");
  return ok();
}
