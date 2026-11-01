import { NextResponse, type NextRequest } from "next/server";

import { safeEqual } from "@/lib/google/crypto";
import { ensureWatch, syncCalendar } from "@/lib/google/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// Chamado pelo pg_cron do Supabase a cada 15 minutos (não usamos o cron da Vercel:
// no plano gratuito ele só roda uma vez por dia). Renova os canais de aviso e
// faz uma sincronização de segurança, caso algum aviso do Google tenha se perdido.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse(null, { status: 401 });

  const admin = createAdminClient();
  const { data: calendars } = await admin.from("calendars").select("*").eq("sync_enabled", true);

  const results = [];
  for (const cal of calendars ?? []) {
    try {
      const watch = await ensureWatch(admin, cal);
      const sync = await syncCalendar(admin, cal);
      results.push({ id: cal.id, ok: true, watch, sync });
    } catch (e) {
      results.push({ id: cal.id, ok: false, error: (e as Error).message });
    }
  }

  // Limpeza: o histórico de sincronização guarda só os últimos 30 dias.
  await admin.from("sync_log").delete().lt("created_at", new Date(Date.now() - 30 * 86_400_000).toISOString());

  return NextResponse.json({ calendars: results.length, results });
}
