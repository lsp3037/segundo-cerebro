import "server-only";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "@/lib/env";
import type { Database } from "./database.types";

// Cliente com a chave secreta: ignora o RLS. Só para o que roda sem usuário logado
// (avisos do Google, rotina do pg_cron) e para ler/gravar tokens do Google.
// Toda função que usa este cliente precisa filtrar por user_id por conta própria.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Variável de ambiente ausente: SUPABASE_SECRET_KEY. Veja o .env.example.");
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
