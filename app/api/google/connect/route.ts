import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { buildAuthUrl, googleConfigured } from "@/lib/google/api";
import { sign } from "@/lib/google/crypto";

// Botão "Conectar Google Agenda": manda para o consentimento do Google.
// O "state" leva o id do usuário assinado e também fica num cookie, contra falsificação.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const origin = new URL(request.url).origin;

  if (!googleConfigured()) {
    return NextResponse.redirect(`${origin}/configuracoes?agenda=nao-configurado#agenda`);
  }

  const nonce = crypto.randomUUID();
  const state = `${nonce}.${sign(`${nonce}:${user.id}`)}`;
  const response = NextResponse.redirect(buildAuthUrl(state, `${origin}/api/google/callback`));
  response.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return response;
}
