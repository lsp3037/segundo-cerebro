"use server";

import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const schema = z.object({
  entity_type: z.string().min(1).max(40),
  entity_id: z.uuid(),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(300),
  mime_type: z.string().max(200).nullable(),
  size_bytes: z.number().int().nonnegative(),
});

// Registra no banco o arquivo já enviado ao Storage (para listar e limpar depois).
export async function recordAttachment(input: z.input<typeof schema>): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success || !parsed.data.storage_path.startsWith(`${user.id}/`)) return fail("Anexo inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("attachments").insert(parsed.data);
  return error ? fail("Não foi possível registrar o anexo.") : ok();
}
