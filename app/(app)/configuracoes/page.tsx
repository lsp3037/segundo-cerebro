import type { Metadata } from "next";

import { PageHeader } from "@/components/page";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleConnections } from "@/lib/data/google";
import { getSidebarData } from "@/lib/data/sidebar";
import { createClient } from "@/lib/supabase/server";
import { GoogleSettings } from "./google-settings";
import { AppearanceSettings, AreaSettings, TrashList } from "./settings-forms";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage(props: PageProps<"/configuracoes">) {
  const user = await getCurrentUser();
  const { agenda } = await props.searchParams;
  const supabase = await createClient();
  const [{ areas }, connections, trashed] = await Promise.all([
    getSidebarData(),
    getGoogleConnections(user.id),
    supabase
      .from("folders")
      .select("id, name, area_id, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader title="Configurações" icon="settings" description="Aparência, áreas, Google Agenda e lixeira." />
      <div className="max-w-3xl space-y-10 px-6 py-6">
        <Section title="Aparência">
          <AppearanceSettings />
        </Section>

        <Section
          title="Áreas"
          description="Cor de destaque de cada área e o que pode ser enviado para a IA (Gemini)."
        >
          <div className="divide-y rounded-xl border">
            {areas.map((area) => (
              <AreaSettings key={area.id} area={area} />
            ))}
          </div>
        </Section>

        <Section
          id="agenda"
          title="Google Agenda"
          description="Contas conectadas e quais agendas aparecem no app. Cada agenda tem uma área padrão para os eventos dela."
        >
          {connections ? (
            <GoogleSettings connections={connections} status={typeof agenda === "string" ? agenda : null} />
          ) : (
            <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
              Faltam as chaves do Google no servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY, CRON_SECRET e
              SUPABASE_SECRET_KEY). Veja o README, Fase 3.
            </p>
          )}
        </Section>

        <Section id="lixeira" title="Lixeira" description="Pastas excluídas. Os itens dentro delas não foram apagados.">
          <TrashList folders={trashed.data ?? []} areas={areas} />
        </Section>
      </div>
    </>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}
