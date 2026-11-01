import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

// Rotas que abrem sem login. Avisos do Google e o pg_cron chegam sem sessão,
// mas cada uma dessas rotas confere a própria assinatura/segredo.
const PUBLIC_PATHS = ["/login", "/auth", "/acesso-negado", "/api/google/webhook", "/api/cron"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Renova a sessão a cada requisição e manda para o login quem não pode entrar.
export async function updateSession(request: NextRequest) {
  // Se o Supabase devolver o login na raiz (URL de retorno fora da lista dele),
  // encaminha o código para a rota que troca o código pela sessão.
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims valida o token; não use getSession aqui.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const { pathname } = request.nextUrl;

  if (!claims) {
    if (isPublic(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Segunda camada do login fechado: e-mail fora da lista é deslogado.
  if (!isEmailAllowed(claims.email as string | undefined)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/acesso-negado";
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/hoje";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
