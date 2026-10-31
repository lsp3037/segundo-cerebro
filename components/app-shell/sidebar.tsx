"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronRightIcon,
  FolderInputIcon,
  FolderPlusIcon,
  GripVerticalIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SettingsIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { updateArea } from "@/lib/actions/areas";
import { renameFolder, reorderFolders, setFolderCollapsed } from "@/lib/actions/folders";
import type { Area, Folder } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { type FolderDialogState, FolderDialogs } from "./folder-dialogs";

type TreeContextValue = {
  childrenOf: (areaId: string, parentId: string | null) => Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  openDialog: (state: FolderDialogState) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  onNavigate: () => void;
};

const TreeContext = createContext<TreeContextValue | null>(null);

function useTree() {
  const ctx = use(TreeContext);
  if (!ctx) throw new Error("useTree fora do Sidebar");
  return ctx;
}

const siblingsKey = (areaId: string, parentId: string | null) => `${areaId}:${parentId ?? "root"}`;

export function Sidebar({
  areas: areasProp,
  folders: foldersProp,
  onNavigate,
}: {
  areas: Area[];
  folders: Folder[];
  onNavigate: () => void;
}) {
  // Estado local para resposta imediata; volta a seguir o servidor quando os dados mudam.
  const [areas, setAreas] = useState(areasProp);
  const [folders, setFolders] = useState(foldersProp);
  const [prevProps, setPrevProps] = useState({ areasProp, foldersProp });
  if (prevProps.areasProp !== areasProp || prevProps.foldersProp !== foldersProp) {
    setPrevProps({ areasProp, foldersProp });
    setAreas(areasProp);
    setFolders(foldersProp);
  }

  const [dialog, setDialog] = useState<FolderDialogState>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Folder[]>();
    for (const folder of folders) {
      const key = siblingsKey(folder.area_id, folder.parent_id);
      map.set(key, [...(map.get(key) ?? []), folder]);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return map;
  }, [folders]);

  const tree: TreeContextValue = {
    childrenOf: (areaId, parentId) => grouped.get(siblingsKey(areaId, parentId)) ?? [],
    setFolders,
    openDialog: setDialog,
    renamingId,
    setRenamingId,
    onNavigate,
  };

  function toggleArea(area: Area) {
    const collapsed = !area.collapsed;
    setAreas((list) => list.map((a) => (a.id === area.id ? { ...a, collapsed } : a)));
    void updateArea(area.id, { collapsed });
  }

  return (
    <TreeContext value={tree}>
      <div className="flex h-full flex-col">
        <ScrollArea className="min-h-0 flex-1">
          <nav aria-label="Áreas e pastas" className="space-y-3 p-2 pt-3">
            {areas.map((area) => (
              <AreaSection key={area.id} area={area} onToggle={() => toggleArea(area)} />
            ))}
          </nav>
        </ScrollArea>
        <div className="border-t p-2">
          <Link
            href="/configuracoes"
            onClick={onNavigate}
            className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <SettingsIcon className="size-4" />
            Configurações
          </Link>
        </div>
      </div>
      <FolderDialogs state={dialog} onClose={() => setDialog(null)} areas={areas} folders={folders} />
    </TreeContext>
  );
}

// Abas que aceitam o filtro por área. Fora delas, clicar na área leva para "Hoje".
const FILTERABLE = ["/hoje", "/agenda", "/entrada", "/ideias", "/conhecimento", "/aprender", "/financas", "/revisao"];

function AreaSection({ area, onToggle }: { area: Area; onToggle: () => void }) {
  const { openDialog, onNavigate } = useTree();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const active = searchParams.get("area") === area.slug;

  function filter() {
    const base = FILTERABLE.some((p) => pathname.startsWith(p)) ? pathname : "/hoje";
    router.push(active ? base : `${base}?area=${area.slug}`);
    onNavigate();
  }

  return (
    <section style={{ "--area": area.color } as React.CSSProperties}>
      <div className="group flex h-8 items-center gap-0.5 rounded-md pr-1 hover:bg-accent/60">
        <button
          type="button"
          onClick={onToggle}
          aria-label={area.collapsed ? `Expandir ${area.name}` : `Recolher ${area.name}`}
          aria-expanded={!area.collapsed}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon className={cn("size-3.5 transition-transform", !area.collapsed && "rotate-90")} />
        </button>
        <button
          type="button"
          onClick={filter}
          title={active ? "Remover filtro" : `Filtrar por ${area.name}`}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 text-left text-[0.8rem] font-semibold tracking-wide uppercase",
            active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
          )}
        >
          <span
            className={cn("size-2 shrink-0 rounded-full bg-(--area)", active && "ring-2 ring-(--area)/30")}
            aria-hidden="true"
          />
          <span className="truncate">{area.name}</span>
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => openDialog({ kind: "create", areaId: area.id, parentId: null })}
          aria-label={`Nova pasta em ${area.name}`}
        >
          <PlusIcon />
        </Button>
      </div>
      {!area.collapsed && <FolderList areaId={area.id} parentId={null} depth={0} />}
    </section>
  );
}

function FolderList({ areaId, parentId, depth }: { areaId: string; parentId: string | null; depth: number }) {
  const { childrenOf, setFolders } = useTree();
  const items = childrenOf(areaId, parentId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((f) => f.id === active.id);
    const to = items.findIndex((f) => f.id === over.id);
    const ordered = arrayMove(items, from, to);
    const order = new Map(ordered.map((f, i) => [f.id, i]));

    let previous: Folder[] = [];
    setFolders((list) => {
      previous = list;
      return list.map((f) => (order.has(f.id) ? { ...f, sort_order: order.get(f.id)! } : f));
    });

    const result = await reorderFolders(ordered.map((f) => f.id));
    if (!result.ok) {
      setFolders(previous);
      toast.error(result.error);
    }
  }

  if (items.length === 0) {
    return depth === 0 ? <p className="py-1 pl-8 text-xs text-muted-foreground">Nenhuma pasta.</p> : null;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((f) => f.id)} strategy={verticalListSortingStrategy}>
        <ul role="list">
          {items.map((folder) => (
            <FolderNode key={folder.id} folder={folder} depth={depth} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function FolderNode({ folder, depth }: { folder: Folder; depth: number }) {
  const { childrenOf, setFolders, openDialog, renamingId, setRenamingId, onNavigate } = useTree();
  const pathname = usePathname();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: folder.id,
  });

  const hasChildren = childrenOf(folder.area_id, folder.id).length > 0;
  const active = pathname === `/p/${folder.id}`;
  const renaming = renamingId === folder.id;

  function toggle() {
    const collapsed = !folder.collapsed;
    setFolders((list) => list.map((f) => (f.id === folder.id ? { ...f, collapsed } : f)));
    void setFolderCollapsed(folder.id, collapsed);
  }

  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cn(isDragging && "relative z-10")}>
      <div
        className={cn(
          "group flex h-7 items-center gap-0.5 rounded-md pr-1 text-sm",
          active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          isDragging && "bg-accent shadow-sm",
        )}
        style={{ paddingLeft: depth * 14 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={folder.collapsed ? `Expandir ${folder.name}` : `Recolher ${folder.name}`}
            aria-expanded={!folder.collapsed}
            className="flex size-6 shrink-0 items-center justify-center rounded hover:text-foreground"
          >
            <ChevronRightIcon className={cn("size-3.5 transition-transform", !folder.collapsed && "rotate-90")} />
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}

        {renaming ? (
          <RenameInput folder={folder} onDone={() => setRenamingId(null)} />
        ) : (
          <Link
            href={`/p/${folder.id}`}
            onClick={onNavigate}
            onDoubleClick={() => setRenamingId(folder.id)}
            aria-current={active ? "page" : undefined}
            className="flex min-w-0 flex-1 items-center gap-2 py-1"
          >
            <Icon name={folder.icon} className={cn("size-3.5 shrink-0", active && "text-(--area)")} />
            <span className="truncate">{folder.name}</span>
          </Link>
        )}

        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Arrastar ${folder.name}`}
          className="flex size-5 shrink-0 cursor-grab touch-none items-center justify-center rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-3.5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              aria-label={`Opções de ${folder.name}`}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-44"
            // Sem isso o foco volta ao botão e o campo de renomear fecha na hora.
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <DropdownMenuItem
              onSelect={() => openDialog({ kind: "create", areaId: folder.area_id, parentId: folder.id })}
            >
              <FolderPlusIcon />
              Nova subpasta
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setRenamingId(folder.id)}>
              <PencilIcon />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openDialog({ kind: "move", folder })}>
              <FolderInputIcon />
              Mover para…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => openDialog({ kind: "delete", folder })}>
              <Trash2Icon />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && !folder.collapsed && <FolderList areaId={folder.area_id} parentId={folder.id} depth={depth + 1} />}
    </li>
  );
}

function RenameInput({ folder, onDone }: { folder: Folder; onDone: () => void }) {
  const { setFolders } = useTree();
  const [value, setValue] = useState(folder.name);
  const cancelled = useRef(false);
  const [, startTransition] = useTransition();

  function commit() {
    const name = value.trim();
    onDone();
    if (cancelled.current || !name || name === folder.name) return;

    setFolders((list) => list.map((f) => (f.id === folder.id ? { ...f, name } : f)));
    startTransition(async () => {
      const result = await renameFolder(folder.id, name);
      if (!result.ok) {
        setFolders((list) => list.map((f) => (f.id === folder.id ? { ...f, name: folder.name } : f)));
        toast.error(result.error);
      }
    });
  }

  return (
    <input
      autoFocus
      value={value}
      maxLength={80}
      aria-label="Novo nome da pasta"
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          onDone();
        }
      }}
      className="h-6 min-w-0 flex-1 rounded border bg-background px-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  );
}
