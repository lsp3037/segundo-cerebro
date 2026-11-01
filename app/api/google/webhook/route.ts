import { after, NextResponse, type NextRequest } from "next/server";

import { safeEqual, sign } from "@/lib/google/crypto";
import { syncCalendar } from "@/lib/google/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

// O Google avisa aqui quando algo muda numa agenda acompanhada.
// O aviso não traz o conteúdo: só dispara a sincronização incremental daquela agenda.
export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id") ?? "";
  const token = request.headers.get("x-goog-channel-token") ?? "";
  const state = request.headers.get("x-goog-resource-state");

  if (!channelId || !token || !safeEqual(token, sign(channelId))) {
    return new NextResponse(null, { status: 401 });
  }
  // "sync" é só a confirmação de que o canal foi criado.
  if (state === "sync") return new NextResponse(null, { status: 200 });

  const admin = createAdminClient();
  const { data: cal } = await admin.from("calendars").select("*").eq("watch_channel_id", channelId).maybeSingle();
  if (!cal || !cal.sync_enabled) return new NextResponse(null, { status: 200 });

  // Responde na hora (o Google espera resposta rápida) e sincroniza em seguida.
  after(async () => {
    try {
      await syncCalendar(admin, cal);
    } catch (e) {
      console.error("webhook sync", cal.id, e);
    }
  });

  return new NextResponse(null, { status: 200 });
}
