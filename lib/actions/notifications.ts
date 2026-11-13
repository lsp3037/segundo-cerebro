"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { MAX_READ_KEYS } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const keysSchema = z.array(z.string().min(1).max(200)).min(1).max(100);

// Marca avisos do sino como lidos. Fica em profiles.settings.notifications_read (vale em qualquer aparelho).
export async function markNotificationsRead(keys: string[]): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = keysSchema.safeParse(keys);
  if (!parsed.success) return fail("Avisos inválidos.");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("settings").eq("user_id", user.id).maybeSingle();
  const settings = (profile?.settings as Record<string, unknown> | null) ?? {};
  const previous = Array.isArray(settings.notifications_read)
    ? settings.notifications_read.filter((k): k is string => typeof k === "string")
    : [];
  const merged = [...previous.filter((k) => !parsed.data.includes(k)), ...parsed.data].slice(-MAX_READ_KEYS);

  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, settings: { ...settings, notifications_read: merged } });
  if (error) return fail("Não foi possível marcar como lido.");
  return ok();
}
