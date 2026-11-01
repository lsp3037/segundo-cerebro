"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Sai só deste navegador; os outros aparelhos continuam logados.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
