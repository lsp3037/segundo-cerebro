"use client";

import { PlusIcon } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import { CaptureDialog } from "@/components/inbox/capture-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceProvider } from "@/components/workspace";
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
  const [captureOpen, setCaptureOpen] = useState(false);

  // Atalhos globais: Ctrl+K (⌘K no Mac) abre a busca; Alt+N abre a captura rápida.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (key === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        setCommandOpen((open) => !open);
      } else if (event.code === "KeyN" && event.altKey && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setCaptureOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const sidebar = <Sidebar areas={areas} folders={folders} onNavigate={() => setNavOpen(false)} />;

  return (
    <WorkspaceProvider areas={areas} folders={folders}>
      <div className="flex h-svh flex-col">
        <Suspense fallback={<div className="h-12 border-b" />}>
          <Topbar
            user={user}
            areas={areas}
            onOpenNav={() => setNavOpen(true)}
            onOpenCommand={() => setCommandOpen(true)}
            onOpenCapture={() => setCaptureOpen(true)}
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

        <CommandMenu
          open={commandOpen}
          onOpenChange={setCommandOpen}
          areas={areas}
          folders={folders}
          onCapture={() => setCaptureOpen(true)}
        />
        <CaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />

        {/* Botão de ação flutuante (FAB) exclusivo no mobile: captura rápida com o polegar */}
        <button
          type="button"
          onClick={() => setCaptureOpen(true)}
          aria-label="Capturar na Caixa de Entrada"
          className="fixed right-4 bottom-5 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden cursor-pointer"
        >
          <PlusIcon className="size-6 stroke-[2.5]" />
        </button>
      </div>
    </WorkspaceProvider>
  );
}
