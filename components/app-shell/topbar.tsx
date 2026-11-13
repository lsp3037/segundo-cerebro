"use client";

import {
  InboxIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SearchIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { BrainMark } from "@/components/brand";
import { Icon } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { signOut } from "@/lib/actions/auth";
import { type Area, TABS } from "@/lib/modules";
import { cn } from "@/lib/utils";
import type { ShellUser } from "./app-shell";
import { NotificationBell } from "./notification-bell";

export function Topbar({
  user,
  areas,
  sidebarCollapsed,
  onToggleSidebar,
  onOpenNav,
  onOpenCommand,
  onOpenCapture,
}: {
  user: ShellUser;
  areas: Area[];
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onOpenNav: () => void;
  onOpenCommand: () => void;
  onOpenCapture: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const areaSlug = searchParams.get("area");
  const filterArea = areas.find((a) => a.slug === areaSlug);
  const query = filterArea ? `?area=${filterArea.slug}` : "";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-2 md:px-3">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenNav} aria-label="Abrir navegação">
        <MenuIcon />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden text-muted-foreground hover:text-foreground md:inline-flex"
        onClick={onToggleSidebar}
        aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-expanded={!sidebarCollapsed}
        title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
      >
        {sidebarCollapsed ? <PanelLeftOpenIcon className="size-4" /> : <PanelLeftCloseIcon className="size-4" />}
      </Button>

      <Link href="/hoje" className="flex shrink-0 items-center gap-2 rounded-md px-1.5 py-1 xl:mr-3">
        <BrainMark className="size-5" />
        <span className="hidden text-sm font-semibold tracking-tight xl:inline">Segundo Cérebro</span>
      </Link>

      <nav aria-label="Seções" className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={`${tab.href}${query}`}
              aria-current={active ? "page" : undefined}
              aria-label={tab.label}
              title={tab.label}
              className={cn(
                "relative flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors",
                active
                  ? "bg-accent font-semibold text-foreground shadow-2xs"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon name={tab.icon} className="size-3.5" />
              {/* No celular/telas pequenas só a aba ativa mostra o texto; a partir de tablets e laptops todas mostram o nome */}
              <span className={active ? "font-semibold" : "hidden md:inline"}>{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {filterArea && (
        <Link
          href={pathname}
          className="hidden shrink-0 items-center gap-1.5 rounded-full border py-0.5 pr-1.5 pl-2.5 text-xs font-medium hover:bg-accent sm:flex"
          title="Remover filtro de área"
        >
          <span className="size-2 rounded-full" style={{ backgroundColor: filterArea.color }} />
          {filterArea.name}
          <XIcon className="size-3 text-muted-foreground" />
        </Link>
      )}

      <Button
        size="sm"
        onClick={onOpenCapture}
        className="shrink-0"
        title="Capturar na Caixa de Entrada (Alt+N)"
      >
        <InboxIcon />
        <span className="hidden lg:inline">Capturar</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onOpenCommand}
        className="hidden w-52 shrink-0 justify-start gap-2 font-normal text-muted-foreground lg:flex"
      >
        <SearchIcon />
        <span className="flex-1 text-left">Buscar…</span>
        <Kbd>Ctrl K</Kbd>
      </Button>
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenCommand} aria-label="Buscar (Ctrl+K)">
        <SearchIcon />
      </Button>

      <NotificationBell />
      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu da conta">
            <Avatar className="size-7">
              {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
              <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/configuracoes">
              <SettingsIcon />
              Configurações
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => signOut()}>
            <LogOutIcon />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
