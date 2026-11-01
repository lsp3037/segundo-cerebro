import "server-only";

// Chamadas diretas às APIs do Google (OAuth e Calendar v3), sem SDK: só o que o app usa.

const OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CAL = "https://www.googleapis.com/calendar/v3";

export const CALENDAR_SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar"];

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET ausentes.");
  return { clientId, clientSecret };
}

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.TOKEN_ENCRYPTION_KEY &&
      process.env.CRON_SECRET &&
      process.env.SUPABASE_SECRET_KEY,
  );
}

export function buildAuthUrl(state: string, redirectUri: string) {
  const params = new URLSearchParams({
    client_id: credentials().clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    // "consent" garante que o Google devolva o refresh token; "select_account" deixa escolher a conta.
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
  });
  return `${OAUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  const json = await res.json();
  if (!res.ok) throw new GoogleApiError(res.status, json.error_description ?? json.error ?? "Falha no token do Google");
  return json;
}

export function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = credentials();
  return tokenRequest({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

export function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = credentials();
  return tokenRequest({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" });
}

export async function revokeToken(token: string) {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined);
}

// O id_token vem direto do Google pela conexão segura da troca de código; só lemos o e-mail.
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Calendar v3
// ---------------------------------------------------------------------------

export type GCalendar = {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole: string;
  timeZone?: string;
};

export type GDateTime = { dateTime?: string; date?: string; timeZone?: string };

export type GEvent = {
  id: string;
  etag: string;
  status: "confirmed" | "tentative" | "cancelled";
  htmlLink?: string;
  updated?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GDateTime;
  end?: GDateTime;
  recurrence?: string[];
  recurringEventId?: string;
  originalStartTime?: GDateTime;
};

export type GEventInput = Partial<Pick<GEvent, "summary" | "description" | "location" | "start" | "end" | "recurrence">>;

async function call<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CAL}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new GoogleApiError(res.status, json?.error?.message ?? `Erro ${res.status} na API do Google Agenda`);
  return json as T;
}

const enc = encodeURIComponent;

export async function listCalendars(token: string): Promise<GCalendar[]> {
  const items: GCalendar[] = [];
  let pageToken: string | undefined;
  do {
    const page = await call<{ items: GCalendar[]; nextPageToken?: string }>(
      token,
      `/users/me/calendarList?maxResults=250${pageToken ? `&pageToken=${enc(pageToken)}` : ""}`,
    );
    items.push(...page.items);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

export function listEventsPage(
  token: string,
  calendarId: string,
  options: { syncToken?: string | null; pageToken?: string; timeMin?: string },
) {
  const params = new URLSearchParams({ maxResults: "2500", showDeleted: "true", singleEvents: "false" });
  if (options.syncToken) params.set("syncToken", options.syncToken);
  else if (options.timeMin) params.set("timeMin", options.timeMin);
  if (options.pageToken) params.set("pageToken", options.pageToken);
  return call<{ items: GEvent[]; nextPageToken?: string; nextSyncToken?: string }>(
    token,
    `/calendars/${enc(calendarId)}/events?${params}`,
  );
}

export function insertEvent(token: string, calendarId: string, body: GEventInput) {
  return call<GEvent>(token, `/calendars/${enc(calendarId)}/events`, { method: "POST", body: JSON.stringify(body) });
}

export function patchEvent(token: string, calendarId: string, eventId: string, body: GEventInput) {
  return call<GEvent>(token, `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function deleteEvent(token: string, calendarId: string, eventId: string) {
  try {
    await call<void>(token, `/calendars/${enc(calendarId)}/events/${enc(eventId)}`, { method: "DELETE" });
  } catch (error) {
    // Já apagado no Google: tudo certo.
    if (error instanceof GoogleApiError && (error.status === 404 || error.status === 410)) return;
    throw error;
  }
}

export function watchEvents(
  token: string,
  calendarId: string,
  channel: { id: string; address: string; token: string; ttlSeconds: number },
) {
  return call<{ resourceId: string; expiration: string }>(token, `/calendars/${enc(calendarId)}/events/watch`, {
    method: "POST",
    body: JSON.stringify({
      id: channel.id,
      type: "web_hook",
      address: channel.address,
      token: channel.token,
      params: { ttl: String(channel.ttlSeconds) },
    }),
  });
}

export async function stopChannel(token: string, channelId: string, resourceId: string) {
  await call<void>(token, "/channels/stop", { method: "POST", body: JSON.stringify({ id: channelId, resourceId }) }).catch(
    () => undefined,
  );
}
