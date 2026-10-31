import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { isEmailAllowed } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

// Lê e confere o usuário logado uma vez por requisição. O proxy já barra
// quem não pode entrar; aqui conferimos de novo, perto dos dados.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login");
  if (!isEmailAllowed(user.email)) redirect("/acesso-negado");

  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email!,
    name: (meta.full_name as string) || (meta.name as string) || user.email!.split("@")[0],
    avatarUrl: (meta.avatar_url as string) ?? null,
  };
});
