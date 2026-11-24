import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getSidebarData } from "@/lib/data/sidebar";
import { getFinanceScope } from "@/lib/finance/scope";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // O bloqueio de rotas do membro fica no proxy; aqui só decide o que o shell mostra.
  // Se a consulta de membro falhar, getFinanceScope lança e a página mostra erro (não vira membro).
  const [user, scope, { areas, folders }] = await Promise.all([getCurrentUser(), getFinanceScope(), getSidebarData()]);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      areas={scope.isMember ? [] : areas}
      folders={scope.isMember ? [] : folders}
      isMember={scope.isMember}
    >
      {children}
    </AppShell>
  );
}
