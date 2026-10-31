import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Volta do login (Google ou link mágico): troca o código pela sessão.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // O banco recusa cadastro de e-mail fora da lista; o Supabase devolve esse erro aqui.
  const errorDescription = searchParams.get("error_description") ?? "";
  if (errorDescription.toLowerCase().includes("saving new user")) {
    return NextResponse.redirect(`${origin}/acesso-negado`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (!isEmailAllowed(data.user?.email)) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/acesso-negado`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=link`);
}

// Só aceita caminhos internos, para ninguém usar o login como redirecionador.
function safeNext(next: string | null) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/hoje";
}
