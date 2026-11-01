import "server-only";

import { TIME_ZONE, todayIso, TZ_OFFSET } from "@/lib/dates";
import type { Tables, TablesInsert } from "@/lib/supabase/database.types";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  type GDateTime,
  type GEvent,
  type GEventInput,
  GoogleApiError,
  listEventsPage,
  patchEvent,
  refreshAccessToken,
  stopChannel,
  watchEvents,
} from "./api";
import { decrypt, encrypt, sign } from "./crypto";

type Admin = ReturnType<typeof createAdminClient>;
type Calendar = Tables<"calendars">;
type EventRow = Tables<"events">;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

// Access token válido da conexão (renova com o refresh token quando está para vencer).
export async function getAccessToken(admin: Admin, connectionId: string): Promise<string> {
  const { data: conn, error } = await admin.from("google_connections").select("*").eq("id", connectionId).single();
  if (error || !conn) throw new Error("Conexão com o Google não encontrada.");

  if (conn.access_token_enc && conn.expires_at && new Date(conn.expires_at).getTime() > Date.now() + 60_000) {
    return decrypt(conn.access_token_enc);
  }

  const fresh = await refreshAccessToken(decrypt(conn.refresh_token_enc));
  await admin
    .from("google_connections")
    .update({
      access_token_enc: encrypt(fresh.access_token),
      expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
      ...(fresh.refresh_token ? { refresh_token_enc: encrypt(fresh.refresh_token) } : {}),
    })
    .eq("id", connectionId);
  return fresh.access_token;
}

// ---------------------------------------------------------------------------
// Conversão de datas entre o Google e o banco
// ---------------------------------------------------------------------------

// Evento de dia inteiro vira meia-noite de Cuiabá; com horário, o instante exato.
export function fromGoogleTime(value: GDateTime | undefined): { iso: string; allDay: boolean } | null {
  if (!value) return null;
  if (value.date) return { iso: new Date(`${value.date}T00:00:00${TZ_OFFSET}`).toISOString(), allDay: true };
  if (value.dateTime) return { iso: new Date(value.dateTime).toISOString(), allDay: false };
  return null;
}

export function toGoogleTime(iso: string, allDay: boolean): GDateTime {
  return allDay ? { date: todayIso(new Date(iso)) } : { dateTime: iso, timeZone: TIME_ZONE };
}

export function eventRowToGoogle(row: Pick<EventRow, "title" | "description" | "location" | "start_at" | "end_at" | "all_day" | "recurrence">): GEventInput {
  return {
    summary: row.title,
    description: row.description ?? undefined,
    location: row.location ?? undefined,
    start: toGoogleTime(row.start_at, row.all_day),
    end: toGoogleTime(row.end_at, row.all_day),
    recurrence: row.recurrence ?? undefined,
  };
}

// Linha do banco a partir de um evento do Google, preservando o que só existe no app (tipo e área).
function googleToRow(cal: Calendar, item: GEvent, existing: Pick<EventRow, "kind" | "area_id"> | undefined): TablesInsert<"events"> | null {
  const start = fromGoogleTime(item.start) ?? fromGoogleTime(item.originalStartTime);
  const end = fromGoogleTime(item.end) ?? start;
  if (!start || !end) return null;

  return {
    user_id: cal.user_id,
    calendar_id: cal.id,
    google_event_id: item.id,
    etag: item.etag,
    area_id: existing?.area_id ?? cal.default_area_id,
    kind: existing?.kind ?? (item.recurrence?.length ? "routine" : "event"),
    title: item.summary?.trim() || "(sem título)",
    description: item.description ?? null,
    location: item.location ?? null,
    start_at: start.iso,
    end_at: end.iso < start.iso ? start.iso : end.iso,
    all_day: start.allDay,
    recurrence: item.recurrence ?? null,
    recurring_event_id: item.recurringEventId ?? null,
    original_start_at: fromGoogleTime(item.originalStartTime)?.iso ?? null,
    status: item.status,
    html_link: item.htmlLink ?? null,
    google_updated_at: item.updated ?? null,
    local_updated_at: item.updated ?? new Date().toISOString(),
    deleted_at: null,
  };
}

// ---------------------------------------------------------------------------
// Sincronização Google → app
// ---------------------------------------------------------------------------

export type SyncResult = { calendarId: string; full: boolean; upserted: number; deleted: number; conflicts: number };

// Sincroniza uma agenda. Sem syncToken (ou com token vencido) faz a busca completa do último ano em diante.
export async function syncCalendar(admin: Admin, cal: Calendar): Promise<SyncResult> {
  const token = await getAccessToken(admin, cal.connection_id);
  try {
    return await runSync(admin, cal, token, cal.sync_token);
  } catch (error) {
    // 410: o Google invalidou o syncToken; recomeça do zero.
    if (error instanceof GoogleApiError && error.status === 410) {
      return runSync(admin, cal, token, null);
    }
    await admin.from("calendars").update({ last_error: String((error as Error).message).slice(0, 500) }).eq("id", cal.id);
    throw error;
  }
}

async function runSync(admin: Admin, cal: Calendar, token: string, syncToken: string | null): Promise<SyncResult> {
  const full = !syncToken;
  const items: GEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;
  const timeMin = new Date(Date.now() - 365 * 86_400_000).toISOString();

  do {
    const page = await listEventsPage(token, cal.google_calendar_id, { syncToken, pageToken, timeMin });
    items.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
    nextSyncToken = page.nextSyncToken ?? nextSyncToken;
  } while (pageToken);

  const { data: existingRows } = await admin
    .from("events")
    .select("id, google_event_id, kind, area_id, etag, local_updated_at, google_updated_at, title, description, location, start_at, end_at, all_day, recurrence")
    .eq("calendar_id", cal.id);
  const existing = new Map((existingRows ?? []).map((r) => [r.google_event_id!, r]));

  const upserts: TablesInsert<"events">[] = [];
  const toDelete: string[] = [];
  const seen = new Set<string>();
  let conflicts = 0;

  for (const item of items) {
    seen.add(item.id);
    const local = existing.get(item.id);

    // Cancelado: ocorrência avulsa de uma repetição fica guardada (para esconder aquela data);
    // evento inteiro cancelado sai do banco.
    if (item.status === "cancelled" && !item.recurringEventId) {
      toDelete.push(item.id);
      continue;
    }

    // Conflito: editado no app depois da última versão do Google e ainda não enviado.
    // Vale a última edição: se a do app é mais nova, ela vai para o Google.
    if (local && item.updated && local.local_updated_at > item.updated && local.etag !== item.etag) {
      conflicts++;
      try {
        const pushed = await patchEvent(token, cal.google_calendar_id, item.id, eventRowToGoogle(local));
        await admin.from("sync_log").insert({
          user_id: cal.user_id,
          calendar_id: cal.id,
          direction: "app_to_google",
          action: "conflict",
          conflict: true,
          winner: "app",
          details: { google_event_id: item.id, google_updated: item.updated, local_updated: local.local_updated_at },
        });
        const row = googleToRow(cal, pushed, local);
        if (row) upserts.push(row);
        continue;
      } catch {
        // Se não deu para enviar, fica a versão do Google (registrada abaixo).
      }
      await admin.from("sync_log").insert({
        user_id: cal.user_id,
        calendar_id: cal.id,
        direction: "google_to_app",
        action: "conflict",
        conflict: true,
        winner: "google",
        details: { google_event_id: item.id, google_updated: item.updated, local_updated: local.local_updated_at },
      });
    }

    const row = googleToRow(cal, item, local);
    if (row) upserts.push(row);
  }

  // Na busca completa, o que existe no banco e não veio do Google foi apagado lá.
  if (full) {
    for (const id of existing.keys()) if (id && !seen.has(id)) toDelete.push(id);
  }

  for (let i = 0; i < upserts.length; i += 500) {
    const { error } = await admin.from("events").upsert(upserts.slice(i, i + 500), { onConflict: "calendar_id,google_event_id" });
    if (error) throw new Error(`Falha ao gravar eventos: ${error.message}`);
  }
  if (toDelete.length) {
    for (let i = 0; i < toDelete.length; i += 200) {
      const chunk = toDelete.slice(i, i + 200);
      await admin.from("events").delete().eq("calendar_id", cal.id).in("google_event_id", chunk);
      // Ocorrências avulsas de uma repetição apagada vão junto.
      await admin.from("events").delete().eq("calendar_id", cal.id).in("recurring_event_id", chunk);
    }
  }

  await admin
    .from("calendars")
    .update({ sync_token: nextSyncToken ?? null, last_synced_at: new Date().toISOString(), last_error: null })
    .eq("id", cal.id);

  if (full || upserts.length || toDelete.length) {
    await admin.from("sync_log").insert({
      user_id: cal.user_id,
      calendar_id: cal.id,
      direction: "google_to_app",
      action: full ? "full_sync" : "incremental_sync",
      details: { upserted: upserts.length, deleted: toDelete.length, conflicts },
    });
  }

  return { calendarId: cal.id, full, upserted: upserts.length, deleted: toDelete.length, conflicts };
}

// ---------------------------------------------------------------------------
// Avisos automáticos (push) do Google
// ---------------------------------------------------------------------------

const WATCH_TTL_SECONDS = 7 * 24 * 60 * 60;

// Garante um canal de aviso ativo para a agenda. Renova quando falta menos de 1 dia.
// Só funciona com o app publicado em HTTPS (o Google não avisa o localhost).
export async function ensureWatch(admin: Admin, cal: Calendar) {
  const appUrl = process.env.APP_URL;
  if (!appUrl?.startsWith("https://")) return { skipped: "APP_URL sem https" };
  if (cal.watch_expires_at && new Date(cal.watch_expires_at).getTime() > Date.now() + 86_400_000) {
    return { skipped: "canal válido" };
  }

  const token = await getAccessToken(admin, cal.connection_id);
  if (cal.watch_channel_id && cal.watch_resource_id) await stopChannel(token, cal.watch_channel_id, cal.watch_resource_id);

  const channelId = crypto.randomUUID();
  const channel = await watchEvents(token, cal.google_calendar_id, {
    id: channelId,
    address: `${appUrl}/api/google/webhook`,
    token: sign(channelId),
    ttlSeconds: WATCH_TTL_SECONDS,
  });

  await admin
    .from("calendars")
    .update({
      watch_channel_id: channelId,
      watch_resource_id: channel.resourceId,
      watch_expires_at: new Date(Number(channel.expiration)).toISOString(),
    })
    .eq("id", cal.id);
  return { renewed: true };
}

export async function stopWatch(admin: Admin, cal: Calendar) {
  if (!cal.watch_channel_id || !cal.watch_resource_id) return;
  try {
    const token = await getAccessToken(admin, cal.connection_id);
    await stopChannel(token, cal.watch_channel_id, cal.watch_resource_id);
  } catch {
    // Sem acesso ao Google: o canal expira sozinho em até 7 dias.
  }
  await admin.from("calendars").update({ watch_channel_id: null, watch_resource_id: null, watch_expires_at: null }).eq("id", cal.id);
}
