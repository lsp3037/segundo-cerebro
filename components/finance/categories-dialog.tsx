"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2Icon, PencilIcon, PlusIcon, TagIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  createFinanceCategory,
  trashFinanceCategory,
  updateFinanceCategory,
} from "@/lib/actions/finance";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { FinanceCategory } from "@/lib/data/finance";
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
import { toastWithUndo } from "./pay-toggle";
import { LEDGER_LABELS, type LedgerType } from "./meta";

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: FinanceCategory[];
  defaultLedger?: "pessoal" | "trustcare";
  onSuccess?: () => void;
}

const PRESET_COLORS = [
  "#10b981", // Emerald
  "#059669", // Dark Green
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#6b7280", // Gray
];

export function CategoriesDialog({
  open,
  onOpenChange,
  categories,
  defaultLedger = "pessoal",
  onSuccess,
}: CategoriesDialogProps) {
  const [isPending, startTransition] = useTransition();

  const [activeLedger, setActiveLedger] = useState<"pessoal" | "trustcare">(defaultLedger);
  const [activeKind, setActiveKind] = useState<"income" | "expense">("expense");

  // Modo de criação / edição
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");

  const filteredCategories = useMemo(() => {
    const list = categories.filter(
      (c) => c.ledger === activeLedger && c.kind === activeKind && !c.deleted_at
    );
    const seen = new Set<string>();
    const unique: FinanceCategory[] = [];
    for (const item of list) {
      const key = item.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  }, [categories, activeLedger, activeKind]);

  const handleStartEdit = (cat: FinanceCategory) => {
    setEditingCategory(cat);
    setName(cat.name);
    setColor(cat.color || "#10b981");
  };

  const handleCancelForm = () => {
    setEditingCategory(null);
    setName("");
    setColor("#10b981");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }

    startTransition(async () => {
      if (editingCategory) {
        const res = await updateFinanceCategory(editingCategory.id, {
          name: name.trim(),
          color,
        });

        if (res.ok) {
          toast.success("Categoria atualizada.");
          handleCancelForm();
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      } else {
        const res = await createFinanceCategory({
          ledger: activeLedger,
          kind: activeKind,
          name: name.trim(),
          color,
          sort_order: filteredCategories.length + 1,
        });

        if (res.ok) {
          toast.success("Categoria criada com sucesso!");
          handleCancelForm();
          onSuccess?.();
        } else {
          toast.error(res.error);
        }
      }
    });
  };

  const handleDelete = (cat: FinanceCategory) => {
    startTransition(async () => {
      const res = await trashFinanceCategory(cat.id);
      if (res.ok) {
        toastWithUndo(`Categoria ${cat.name} excluída.`, () => restoreFinanceItem("category", cat.id));
        onSuccess?.();
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/80 bg-card p-6 shadow-xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <TagIcon className="size-4 text-primary" />
            Gerenciar Categorias
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Personalize as categorias de receitas e despesas do seu orçamento familiar ou empresarial.
          </DialogDescription>
        </DialogHeader>

        {/* Alternador de Conta: Pessoal / Familiar vs Trust Care */}
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => {
              setActiveLedger("pessoal");
              handleCancelForm();
            }}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeLedger === "pessoal"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pessoal & Familiar
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveLedger("trustcare");
              handleCancelForm();
            }}
            className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
              activeLedger === "trustcare"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Trust Care
          </button>
        </div>

        {/* Alternador: Entradas vs Saídas */}
        <div className="flex items-center justify-between border-b border-border/50 pb-2 pt-1 text-xs">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveKind("expense");
                handleCancelForm();
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeKind === "expense"
                  ? "bg-rose-500/20 text-rose-400 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Despesas (Saídas)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveKind("income");
                handleCancelForm();
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                activeKind === "income"
                  ? "bg-emerald-500/20 text-emerald-400 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Receitas (Entradas)
            </button>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {filteredCategories.length} cadastradas
          </span>
        </div>

        {/* Lista de Categorias Atuais */}
        <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {filteredCategories.map((c) => (
            <div
              key={c.id}
              className="group flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: c.color || "#94a3b8" }}
                />
                <span className="font-medium text-foreground">{c.name}</span>
              </div>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStartEdit(c)}
                  className="size-6 p-0 text-muted-foreground hover:text-foreground"
                  title="Editar"
                >
                  <PencilIcon className="size-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(c)}
                  className="size-6 p-0 text-rose-400 hover:text-rose-300"
                  title="Excluir"
                >
                  <Trash2Icon className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Formulário Inline: Adicionar / Editar */}
        <form onSubmit={handleSubmit} className="mt-2 rounded-xl border border-border/80 bg-muted/30 p-3 space-y-3">
          <div className="text-xs font-semibold text-foreground">
            {editingCategory ? "Editar Categoria" : "Nova Categoria"}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="cat-name" className="text-[11px] text-muted-foreground">
                Nome da Categoria
              </Label>
              <Input
                id="cat-name"
                placeholder="Ex: Aluguel, Supermercado, Dividendos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-8 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-[11px] text-muted-foreground">Cor da Etiqueta</Label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {PRESET_COLORS.slice(0, 8).map((pc) => (
                  <button
                    key={pc}
                    type="button"
                    onClick={() => setColor(pc)}
                    className={`size-4 rounded-full transition-transform ${
                      color === pc ? "scale-125 ring-2 ring-primary ring-offset-1" : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: pc }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            {editingCategory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelForm}
                className="h-7 text-xs"
              >
                Cancelar
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isPending} className="h-7 text-xs gap-1">
              {isPending && <Loader2Icon className="size-3 animate-spin" />}
              {editingCategory ? "Atualizar" : "Adicionar Categoria"}
            </Button>
          </div>
        </form>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full text-xs"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
