"use client";

import { PlusIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, useSyncExternalStore } from "react";

import { CaptureDialog } from "@/components/inbox/capture-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WorkspaceProvider } from "@/components/workspace";
import type { Area, Folder } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { CommandMenu } from "./command-menu";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export type ShellUser = { name: string; email: string; avatarUrl: string | null };

const SIDEBAR_STORAGE_KEY = "segundo-cerebro:sidebar-collapsed";
const SIDEBAR_EVENT = "segundo-cerebro:sidebar-change";

function subscribeSidebarCollapsed(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(SIDEBAR_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(SIDEBAR_EVENT, cb);
  };
}

function getSidebarCollapsedSnapshot() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function getSidebarCollapsedServerSnapshot() {
  return false;
}

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
  const sidebarCollapsed = useSyncExternalStore(
    subscribeSidebarCollapsed,
    getSidebarCollapsedSnapshot,
    getSidebarCollapsedServerSnapshot,
  );

  function toggleSidebarCollapsed() {
    const next = !sidebarCollapsed;
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignora erro caso localStorage esteja bloqueado
    }
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

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

  const pathname = usePathname();
  const isFinanceRoute =
    pathname.startsWith("/financas") ||
    folders.some((f) => pathname === `/p/${f.id}` && f.module === "finance");

  return (
    <WorkspaceProvider areas={areas} folders={folders}>
      <div className="flex h-svh flex-col">
        <Suspense fallback={<div className="h-12 border-b" />}>
          <Topbar
            user={user}
            areas={areas}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebarCollapsed}
            onOpenNav={() => setNavOpen(true)}
            onOpenCommand={() => setCommandOpen(true)}
            onOpenCapture={() => setCaptureOpen(true)}
          />
        </Suspense>

        <div className="flex min-h-0 flex-1">
          <aside
            className={cn(
              "hidden shrink-0 border-r bg-sidebar transition-[width] duration-200 ease-out md:block",
              sidebarCollapsed ? "w-14" : "w-64",
            )}
          >
            <Suspense>
              <Sidebar
                areas={areas}
                folders={folders}
                collapsed={sidebarCollapsed}
                onNavigate={() => setNavOpen(false)}
              />
            </Suspense>
          </aside>
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>

        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetContent side="left" className="w-72 gap-0 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navegação</SheetTitle>
              <SheetDescription>Áreas e pastas</SheetDescription>
            </SheetHeader>
            <Suspense>
              <Sidebar areas={areas} folders={folders} onNavigate={() => setNavOpen(false)} />
            </Suspense>
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

        {/* Botão de ação flutuante (FAB) exclusivo no mobile: captura rápida com o polegar (oculto em Finanças) */}
        {!isFinanceRoute && (
          <button
            type="button"
            onClick={() => setCaptureOpen(true)}
            aria-label="Capturar na Caixa de Entrada"
            className="fixed right-4 bottom-5 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden cursor-pointer"
          >
            <PlusIcon className="size-6 stroke-[2.5]" />
          </button>
        )}
      </div>
    </WorkspaceProvider>
  );
}
