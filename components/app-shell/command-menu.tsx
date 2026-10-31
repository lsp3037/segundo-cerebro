"use client";

import { MonitorIcon, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMemo } from "react";

import { Icon } from "@/components/icon";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type Area, type Folder, TABS } from "@/lib/modules";

// Na Fase 1 a busca navega entre telas, áreas e pastas.
// A busca no conteúdo (tarefas, notas…) entra na Fase 2, e o modo "perguntar" na Fase 6.
export function CommandMenu({
  open,
  onOpenChange,
  areas,
  folders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Area[];
  folders: Folder[];
}) {
  const router = useRouter();
  const { setTheme } = useTheme();

  const folderEntries = useMemo(() => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const areaById = new Map(areas.map((a) => [a.id, a]));
    return folders
      .map((folder) => {
        const path: string[] = [];
        for (let f: Folder | undefined = folder; f; f = f.parent_id ? byId.get(f.parent_id) : undefined) {
          path.unshift(f.name);
        }
        const area = areaById.get(folder.area_id);
        return { folder, area, path: [area?.name ?? "", ...path].join(" › ") };
      })
      .sort((a, b) => a.path.localeCompare(b.path, "pt-BR"));
  }, [areas, folders]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  function run(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Busca"
      description="Vá para uma tela, área ou pasta"
    >
      <CommandInput placeholder="Para onde você quer ir?" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>

        <CommandGroup heading="Telas">
          {TABS.map((tab) => (
            <CommandItem key={tab.href} value={`tela ${tab.label}`} onSelect={() => go(tab.href)}>
              <Icon name={tab.icon} />
              {tab.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Filtrar por área">
          {areas.map((area) => (
            <CommandItem key={area.id} value={`area ${area.name}`} onSelect={() => go(`/hoje?area=${area.slug}`)}>
              <span className="size-2 rounded-full" style={{ backgroundColor: area.color }} />
              {area.name}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Pastas">
          {folderEntries.map(({ folder, area, path }) => (
            <CommandItem key={folder.id} value={`pasta ${path}`} onSelect={() => go(`/p/${folder.id}`)}>
              <Icon name={folder.icon} className="text-muted-foreground" />
              <span className="truncate">{path}</span>
              {area && <span className="ml-auto size-1.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Ações">
          <CommandItem value="configuracoes" onSelect={() => go("/configuracoes")}>
            <SettingsIcon />
            Configurações
          </CommandItem>
          <CommandItem value="tema claro" onSelect={() => run(() => setTheme("light"))}>
            <SunIcon />
            Tema claro
          </CommandItem>
          <CommandItem value="tema escuro" onSelect={() => run(() => setTheme("dark"))}>
            <MoonIcon />
            Tema escuro
          </CommandItem>
          <CommandItem value="tema sistema" onSelect={() => run(() => setTheme("system"))}>
            <MonitorIcon />
            Tema igual ao sistema
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
