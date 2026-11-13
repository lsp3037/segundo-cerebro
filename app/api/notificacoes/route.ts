import { NextResponse } from "next/server";

import { getNotifications } from "@/lib/data/notifications";
import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Avisos do sino. O navegador busca ao abrir, a cada minuto e ao voltar para a aba.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !isEmailAllowed(data.user.email)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const notifications = await getNotifications();
    return NextResponse.json({ notifications }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/notificacoes:", error);
    return NextResponse.json({ error: "Não foi possível carregar os avisos." }, { status: 500 });
  }
}
