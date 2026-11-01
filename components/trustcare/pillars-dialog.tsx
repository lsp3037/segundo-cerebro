"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createPillar, deletePillar, updatePillar } from "@/lib/actions/content";
import { AREA_COLOR_PRESETS } from "@/lib/modules";
import type { Tables } from "@/lib/supabase/database.types";

type Pillar = Tables<"content_pillars">;

// Cadastro dos pilares de conteúdo (nome e cor), usados para agrupar as ideias.
export function PillarsDialog({
  open,
  onOpenChange,
  pillars,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pillars: Pillar[];
  onChange: (pillars: Pillar[]) => void;
}) {
  const [name, setName] = useState("");

  async function add() {
    if (!name.trim()) return;
    const color = AREA_COLOR_PRESETS[pillars.length % AREA_COLOR_PRESETS.length];
    const result = await createPillar({ name, color, sort_order: pillars.length });
    if (!result.ok) return toast.error(result.error);
    onChange([...pillars, result.data]);
    setName("");
  }

  async function save(pillar: Pillar, patch: Partial<Pillar>) {
    const before = pillars;
    onChange(pillars.map((p) => (p.id === pillar.id ? { ...p, ...patch } : p)));
    const result = await updatePillar(pillar.id, { name: patch.name, color: patch.color });
    if (!result.ok) {
      onChange(before);
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pilares de conteúdo</DialogTitle>
          <DialogDescription>Os grandes temas da Trust Care (ex.: dicas, bastidores, prova social).</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {pillars.map((p) => (
            <PillarRow
              key={p.id}
              pillar={p}
              onSave={(patch) => save(p, patch)}
              onDelete={async () => {
                const result = await deletePillar(p.id);
                if (!result.ok) return toast.error(result.error);
                onChange(pillars.filter((x) => x.id !== p.id));
              }}
            />
          ))}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Novo pilar" maxLength={80} aria-label="Nome do novo pilar" />
          <Button type="submit" variant="outline" size="icon" aria-label="Adicionar pilar">
            <PlusIcon />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PillarRow({ pillar, onSave, onDelete }: { pillar: Pillar; onSave: (patch: Partial<Pillar>) => void; onDelete: () => void }) {
  const [name, setName] = useState(pillar.name);

  return (
    <li className="flex items-center gap-2">
      <input
        type="color"
        value={pillar.color ?? "#525252"}
        onChange={(e) => onSave({ color: e.target.value })}
        aria-label={`Cor de ${pillar.name}`}
        className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== pillar.name && onSave({ name: name.trim() })}
        aria-label="Nome do pilar"
        maxLength={80}
      />
      <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Excluir ${pillar.name}`}>
        <Trash2Icon />
      </Button>
    </li>
  );
}
