import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";

// Rotas que abrem sem login. Avisos do Google e o pg_cron chegam sem sessão,
// mas cada uma dessas rotas confere a própria assinatura/segredo.
const PUBLIC_PATHS = ["/login", "/auth", "/acesso-negado", "/privacidade", "/termos", "/api/google/webhook", "/api/cron"];

// O que um membro das Finanças (esposa) pode abrir. Todo o resto volta para /financas
// (páginas) ou recebe 403 (API). O sino usa /api/notificacoes.
const MEMBER_HOME = "/financas";
const MEMBER_PATHS = [MEMBER_HOME, "/api/notificacoes"];

function matchesAny(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublic(pathname: string) {
  return matchesAny(pathname, PUBLIC_PATHS);
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
    return withCookies(NextResponse.redirect(url), response);
  }

  // Rotas livres e as de Finanças passam direto, sem consulta extra.
  if (pathname !== "/login" && (isPublic(pathname) || matchesAny(pathname, MEMBER_PATHS))) return response;

  // Rota só do dono (ou a volta do /login): membro volta para Finanças; API responde 403.
  const isMember = await isFinanceMember(supabase);
  if (isMember && pathname.startsWith("/api/")) {
    return withCookies(NextResponse.json({ error: "Sem acesso a esta área." }, { status: 403 }), response);
  }
  if (isMember || pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = isMember ? MEMBER_HOME : "/hoje";
    url.search = "";
    return withCookies(NextResponse.redirect(url), response);
  }

  return response;
}

// Erro na consulta não vira "membro": a requisição segue e quem decide é o servidor
// (o layout e as ações chamam getFinanceScope, que falha em vez de liberar).
async function isFinanceMember(supabase: ReturnType<typeof createServerClient>) {
  const { data, error } = await supabase.rpc("finance_member_owner");
  if (error) {
    console.error("proxy finance_member_owner:", error);
    return false;
  }
  return !!data;
}

// Leva para a resposta nova os cookies de sessão renovados nesta requisição.
function withCookies(target: NextResponse, source: NextResponse) {
  source.cookies.getAll().forEach((c) => target.cookies.set(c));
  return target;
}
