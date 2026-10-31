"use client";

import { Suspense, useEffect, useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Area, Folder } from "@/lib/modules";
import { CommandMenu } from "./command-menu";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export type ShellUser = { name: string; email: string; avatarUrl: string | null };

export function AppShell({
  user,
  areas,
  folders,
  children,
}: {
  user: ShellUser;
  areas: Area[];
  folders: Folder[];
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  // Ctrl+K (ou ⌘K no Mac) abre a busca de qualquer lugar.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sidebar = <Sidebar areas={areas} folders={folders} onNavigate={() => setNavOpen(false)} />;

  return (
    <div className="flex h-svh flex-col">
      <Suspense fallback={<div className="h-12 border-b" />}>
        <Topbar
          user={user}
          areas={areas}
          onOpenNav={() => setNavOpen(true)}
          onOpenCommand={() => setCommandOpen(true)}
        />
      </Suspense>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block">
          <Suspense>{sidebar}</Suspense>
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação</SheetTitle>
            <SheetDescription>Áreas e pastas</SheetDescription>
          </SheetHeader>
          <Suspense>{sidebar}</Suspense>
        </SheetContent>
      </Sheet>

      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} areas={areas} folders={folders} />
    </div>
  );
}
