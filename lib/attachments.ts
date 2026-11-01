"use client";

import { recordAttachment } from "@/lib/actions/attachments";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 50 * 1024 * 1024;

// Envia um arquivo para o bucket privado (pasta do próprio usuário) e devolve o endereço fixo
// /api/arquivos/..., que funciona enquanto a pessoa estiver logada.
export async function uploadAttachment(file: File, entity: { type: string; id: string }): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Arquivo maior que 50 MB.");

  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sessão expirada. Entre de novo.");

  const safeName = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `${data.user.id}/${entity.type}/${entity.id}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from("attachments").upload(path, file, { contentType: file.type });
  if (error) throw new Error("Não foi possível enviar o arquivo.");

  await recordAttachment({
    entity_type: entity.type,
    entity_id: entity.id,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
  });

  return `/api/arquivos/${path}`;
}
