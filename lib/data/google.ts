import "server-only";

import { googleConfigured } from "@/lib/google/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ConnectionView = {
  id: string;
  email: string;
  calendars: {
    id: string;
    name: string;
    color: string | null;
    is_primary: boolean;
    sync_enabled: boolean;
    default_area_id: string | null;
    last_synced_at: string | null;
    last_error: string | null;
    writable: boolean;
  }[];
};

// Contas Google conectadas e suas agendas, para Configurações.
// A tabela de conexões é fechada para o navegador: lemos com o cliente admin,
// filtrando pelo usuário e sem nunca devolver os tokens.
export async function getGoogleConnections(userId: string): Promise<ConnectionView[] | null> {
  if (!googleConfigured()) return null;

  const admin = createAdminClient();
  const supabase = await createClient();
  const [{ data: conns }, { data: cals }] = await Promise.all([
    admin.from("google_connections").select("id, google_email").eq("user_id", userId).order("created_at"),
    supabase
      .from("calendars")
      .select("id, connection_id, name, color, is_primary, sync_enabled, default_area_id, last_synced_at, last_error, access_role")
      .order("is_primary", { ascending: false })
      .order("name"),
  ]);

  return (conns ?? []).map((c) => ({
    id: c.id,
    email: c.google_email,
    calendars: (cals ?? [])
      .filter((cal) => cal.connection_id === c.id)
      .map((cal) => ({
        id: cal.id,
        name: cal.name,
        color: cal.color,
        is_primary: cal.is_primary,
        sync_enabled: cal.sync_enabled,
        default_area_id: cal.default_area_id,
        last_synced_at: cal.last_synced_at,
        last_error: cal.last_error,
        writable: !cal.access_role || ["owner", "writer"].includes(cal.access_role),
      })),
  }));
}
