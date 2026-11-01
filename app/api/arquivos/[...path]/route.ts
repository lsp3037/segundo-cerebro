import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Endereço fixo dos anexos (usado dentro das notas). O bucket é privado:
// aqui conferimos o dono e redirecionamos para um link temporário do Supabase.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/arquivos/[...path]">) {
  const { path } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user || !isEmailAllowed(user.email)) return new NextResponse("Não autorizado", { status: 401 });
  if (path[0] !== user.id || path.some((p) => p === ".." || p === "")) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const { data: signed } = await supabase.storage.from("attachments").createSignedUrl(path.join("/"), 300);
  if (!signed) return new NextResponse("Não encontrado", { status: 404 });

  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, max-age=240" } });
}
