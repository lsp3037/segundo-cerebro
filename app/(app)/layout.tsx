import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentUser } from "@/lib/auth";
import { getSidebarData } from "@/lib/data/sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, { areas, folders }] = await Promise.all([getCurrentUser(), getSidebarData()]);

  return (
    <AppShell user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }} areas={areas} folders={folders}>
      {children}
    </AppShell>
  );
}
