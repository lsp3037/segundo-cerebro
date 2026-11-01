"use client";

import { InboxIcon, MonitorIcon, MoonIcon, SettingsIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type SearchHit, searchContent } from "@/lib/actions/search";
import { type Area, type Folder, TABS } from "@/lib/modules";

const HIT_META: Record<SearchHit["kind"], { label: string; icon: string; href: (id: string) => string }> = {
  task: { label: "Tarefa", icon: "list-checks", href: (id) => `/hoje?v=lista&tarefa=${id}` },
  note: { label: "Nota", icon: "file-text", href: (id) => `/conhecimento/${id}` },
  idea: { label: "Ideia", icon: "lightbulb", href: (id) => `/ideias?ideia=${id}` },
  learning: { label: "Aprender", icon: "graduation-cap", href: (id) => `/aprender?item=${id}` },
  inbox: { label: "Caixa de Entrada", icon: "inbox", href: () => "/entrada" },
};

// Busca: telas, áreas, pastas e, a partir de 2 letras, o conteúdo (tarefas, notas, ideias…).
// O modo "perguntar" com IA entra na Fase 6.
export function CommandMenu({
  open,
  onOpenChange,
  areas,
  folders,
  onCapture,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Area[];
  folders: Folder[];
  onCapture: () => void;
}) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const latest = useRef(0);

  // Busca no conteúdo com um pequeno atraso; respostas antigas são descartadas.
  useEffect(() => {
    const q = query.trim();
    const ticket = ++latest.current;
    if (q.length < 2) return;
    const timer = setTimeout(async () => {
      setSearching(true);
      const result = await searchContent(q);
      if (ticket !== latest.current) return;
      setSearching(false);
      setHits(result.ok ? result.data : []);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function changeOpen(next: boolean) {
    if (!next) {
      setQuery("");
      setHits([]);
    }
    onOpenChange(next);
  }

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
    changeOpen(false);
    router.push(href);
  }

  function run(action: () => void) {
    changeOpen(false);
    action();
  }

  const visibleHits = query.trim().length >= 2 ? hits : [];

  return (
    <CommandDialog
      open={open}
      onOpenChange={changeOpen}
      title="Busca"
      description="Vá para uma tela, área ou pasta, ou procure no seu conteúdo"
    >
      {/* Nesta versão do shadcn, o CommandDialog não inclui o <Command>; sem ele a busca quebra. */}
      <Command>
        <CommandInput placeholder="Buscar telas, pastas, tarefas, notas…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{searching ? "Buscando…" : "Nada encontrado."}</CommandEmpty>

          {visibleHits.length > 0 && (
            <CommandGroup heading="No seu conteúdo">
              {visibleHits.map((hit) => {
                const meta = HIT_META[hit.kind];
                const area = hit.area_id ? areas.find((a) => a.id === hit.area_id) : undefined;
                return (
                  <CommandItem
                    key={`${hit.kind}-${hit.id}`}
                    value={`conteudo ${query} ${hit.kind} ${hit.id}`}
                    onSelect={() => go(meta.href(hit.id))}
                  >
                    <Icon name={meta.icon} className="text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{hit.title}</span>
                      {hit.snippet && <span className="block truncate text-xs text-muted-foreground">{hit.snippet}</span>}
                    </span>
                    {area && <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />}
                    <span className="shrink-0 text-xs text-muted-foreground">{meta.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

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
            <CommandItem value="capturar caixa de entrada" onSelect={() => run(onCapture)}>
              <InboxIcon />
              Capturar na Caixa de Entrada
            </CommandItem>
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
      </Command>
    </CommandDialog>
  );
}
