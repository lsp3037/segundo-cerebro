import { after, NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { emailFromIdToken, exchangeCode, listCalendars } from "@/lib/google/api";
import { encrypt, safeEqual, sign } from "@/lib/google/crypto";
import { ensureWatch, syncCalendar } from "@/lib/google/sync";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Volta do consentimento do Google: guarda a conexão (token criptografado),
// cadastra as agendas e dispara a primeira sincronização da agenda principal.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const url = new URL(request.url);
  const done = (status: string) => {
    const response = NextResponse.redirect(`${url.origin}/configuracoes?agenda=${status}#agenda`);
    response.cookies.delete({ name: "g_oauth_state", path: "/api/google" });
    return response;
  };

  const state = url.searchParams.get("state") ?? "";
  const cookieState = request.cookies.get("g_oauth_state")?.value ?? "";
  const [nonce, signature] = state.split(".");
  if (!state || !safeEqual(state, cookieState) || !nonce || !signature || !safeEqual(signature, sign(`${nonce}:${user.id}`))) {
    return done("erro-seguranca");
  }
  if (url.searchParams.get("error")) return done("cancelado");

  const code = url.searchParams.get("code");
  if (!code) return done("erro");

  try {
    const tokens = await exchangeCode(code, `${url.origin}/api/google/callback`);
    const email = emailFromIdToken(tokens.id_token);
    if (!email) return done("erro");
    if (!tokens.scope.includes("https://www.googleapis.com/auth/calendar")) return done("sem-permissao");

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("google_connections")
      .select("id, refresh_token_enc")
      .eq("user_id", user.id)
      .eq("google_email", email)
      .maybeSingle();

    const refreshEnc = tokens.refresh_token ? encrypt(tokens.refresh_token) : existing?.refresh_token_enc;
    if (!refreshEnc) return done("sem-refresh");

    const { data: conn, error } = await admin
      .from("google_connections")
      .upsert(
        {
          user_id: user.id,
          google_email: email,
          refresh_token_enc: refreshEnc,
          access_token_enc: encrypt(tokens.access_token),
          expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: tokens.scope.split(" "),
        },
        { onConflict: "user_id,google_email" },
      )
      .select("id")
      .single();
    if (error || !conn) return done("erro");

    // Agendas da conta. A principal já nasce sincronizando; as outras você liga em Configurações.
    // Conta da SES cai na área Profissional; as demais, em Pessoal.
    const supabase = await createClient();
    const { data: areas } = await supabase.from("areas").select("id, slug");
    const areaSlug = email.endsWith("@ses.mt.gov.br") ? "profissional" : "pessoal";
    const defaultArea = areas?.find((a) => a.slug === areaSlug)?.id ?? null;

    const calendars = await listCalendars(tokens.access_token);
    const { data: known } = await admin.from("calendars").select("google_calendar_id").eq("connection_id", conn.id);
    const knownIds = new Set((known ?? []).map((c) => c.google_calendar_id));

    const rows = calendars
      .filter((c) => !knownIds.has(c.id))
      .map((c) => ({
        user_id: user.id,
        connection_id: conn.id,
        google_calendar_id: c.id,
        name: c.summary,
        color: c.backgroundColor ?? null,
        default_area_id: defaultArea,
        sync_enabled: Boolean(c.primary),
        is_primary: Boolean(c.primary),
        access_role: c.accessRole,
        time_zone: c.timeZone ?? null,
      }));
    if (rows.length) await admin.from("calendars").insert(rows);

    // A primeira sincronização pode demorar: roda depois de responder.
    after(async () => {
      const { data: enabled } = await admin.from("calendars").select("*").eq("connection_id", conn.id).eq("sync_enabled", true);
      for (const cal of enabled ?? []) {
        try {
          await syncCalendar(admin, cal);
          await ensureWatch(admin, cal);
        } catch (e) {
          console.error("sync inicial", cal.id, e);
        }
      }
    });

    return done("conectado");
  } catch (e) {
    console.error("google callback", e);
    return done("erro");
  }
}
