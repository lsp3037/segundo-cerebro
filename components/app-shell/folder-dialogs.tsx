"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFolder, moveFolder, trashFolder } from "@/lib/actions/folders";
import { type Area, type Folder, FOLDER_MODULES, type FolderModule, MODULES } from "@/lib/modules";

export type FolderDialogState =
  | { kind: "create"; areaId: string; parentId: string | null }
  | { kind: "move"; folder: Folder }
  | { kind: "delete"; folder: Folder }
  | null;

export function FolderDialogs({
  state,
  onClose,
  areas,
  folders,
}: {
  state: FolderDialogState;
  onClose: () => void;
  areas: Area[];
  folders: Folder[];
}) {
  return (
    <>
      <Dialog open={state?.kind === "create"} onOpenChange={(open) => !open && onClose()}>
        {state?.kind === "create" && (
          <CreateFolderContent key={`${state.areaId}:${state.parentId}`} state={state} areas={areas} folders={folders} onClose={onClose} />
        )}
      </Dialog>
      <Dialog open={state?.kind === "move"} onOpenChange={(open) => !open && onClose()}>
        {state?.kind === "move" && (
          <MoveFolderContent key={state.folder.id} folder={state.folder} areas={areas} folders={folders} onClose={onClose} />
        )}
      </Dialog>
      <AlertDialog open={state?.kind === "delete"} onOpenChange={(open) => !open && onClose()}>
        {state?.kind === "delete" && <DeleteFolderContent folder={state.folder} folders={folders} onClose={onClose} />}
      </AlertDialog>
    </>
  );
}

function CreateFolderContent({
  state,
  areas,
  folders,
  onClose,
}: {
  state: { areaId: string; parentId: string | null };
  areas: Area[];
  folders: Folder[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [module, setModule] = useState<FolderModule>("notes");
  const [pending, startTransition] = useTransition();
  const parent = folders.find((f) => f.id === state.parentId);
  const area = areas.find((a) => a.id === state.areaId);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await createFolder({ ...state, name, module: parent ? undefined : module });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onClose();
      router.push(`/p/${result.data.id}`);
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="contents">
        <DialogHeader>
          <DialogTitle>{parent ? "Nova subpasta" : "Nova pasta"}</DialogTitle>
          <DialogDescription>
            {parent ? (
              <>
                Dentro de <strong>{parent.name}</strong>. Mostra o mesmo tipo de conteúdo ({MODULES[parent.module as FolderModule].label.toLowerCase()}).
              </>
            ) : (
              <>
                Na área <strong>{area?.name}</strong>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Nome</Label>
            <Input id="folder-name" autoFocus required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {!parent && (
            <div className="space-y-1.5">
              <Label htmlFor="folder-module">O que a pasta guarda</Label>
              <Select value={module} onValueChange={(v) => setModule(v as FolderModule)}>
                <SelectTrigger id="folder-module" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FOLDER_MODULES.map((key) => (
                    <SelectItem key={key} value={key}>
                      {MODULES[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{MODULES[module].description}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending && <Loader2Icon className="animate-spin" />}
            Criar pasta
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function MoveFolderContent({
  folder,
  areas,
  folders,
  onClose,
}: {
  folder: Folder;
  areas: Area[];
  folders: Folder[];
  onClose: () => void;
}) {
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();

  // Destinos possíveis: raiz de cada área e qualquer pasta que não seja ela mesma ou uma subpasta dela.
  const blocked = new Set([folder.id]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of folders) {
      if (f.parent_id && blocked.has(f.parent_id) && !blocked.has(f.id)) {
        blocked.add(f.id);
        changed = true;
      }
    }
  }

  const options = areas.flatMap((area) => {
    const rows: { value: string; label: string; depth: number }[] = [
      { value: `area:${area.id}`, label: `${area.name} (raiz)`, depth: 0 },
    ];
    const walk = (parentId: string | null, depth: number) => {
      folders
        .filter((f) => f.area_id === area.id && f.parent_id === parentId && !blocked.has(f.id))
        .sort((a, b) => a.sort_order - b.sort_order)
        .forEach((f) => {
          rows.push({ value: `folder:${f.id}`, label: f.name, depth });
          walk(f.id, depth + 1);
        });
    };
    walk(null, 1);
    return rows;
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const [kind, id] = target.split(":");
    const destination =
      kind === "area"
        ? { areaId: id, parentId: null }
        : { areaId: folders.find((f) => f.id === id)!.area_id, parentId: id };

    startTransition(async () => {
      const result = await moveFolder(folder.id, destination);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pasta movida.");
      onClose();
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="contents">
        <DialogHeader>
          <DialogTitle>Mover “{folder.name}”</DialogTitle>
          <DialogDescription>As subpastas vão junto.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="move-target">Para onde</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="move-target" className="w-full">
              <SelectValue placeholder="Escolha o destino" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === `folder:${folder.parent_id}`}>
                  <span style={{ paddingLeft: o.depth * 12 }} className={o.depth === 0 ? "font-medium" : undefined}>
                    {o.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !target}>
            {pending && <Loader2Icon className="animate-spin" />}
            Mover
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function DeleteFolderContent({ folder, folders, onClose }: { folder: Folder; folders: Folder[]; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const subfolders = folders.filter((f) => f.parent_id === folder.id).length;

  function confirm(event: React.MouseEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await trashFolder(folder.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onClose();
      toast.success("Pasta enviada para a lixeira.", {
        action: { label: "Ver lixeira", onClick: () => router.push("/configuracoes#lixeira") },
      });
      if (window.location.pathname === `/p/${folder.id}`) router.push("/hoje");
    });
  }

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Excluir “{folder.name}”?</AlertDialogTitle>
        <AlertDialogDescription>
          A pasta{subfolders > 0 ? " e as subpastas" : ""} vão para a lixeira e podem ser restauradas em
          Configurações. Os itens guardados nela não são apagados.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        <AlertDialogAction variant="destructive" onClick={confirm} disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />}
          Excluir
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
