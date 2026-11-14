"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteInvestmentMovement } from "@/lib/actions/finance-investments";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { IsoDate } from "@/lib/dates";
import type { MovementKind } from "@/lib/finance/investments";
import type { InvestmentMovementView } from "@/lib/finance/investments-data";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatMovementDate, signedBrl } from "./investment-format";
import { toastWithUndo } from "./pay-toggle";

const KIND_LABEL: Record<MovementKind, string> = {
  deposit: "Guardou",
  withdrawal: "Resgatou",
  adjustment: "Ajuste",
};

const DELETED_LABEL: Record<MovementKind, string> = {
  deposit: "Aporte",
  withdrawal: "Resgate",
  adjustment: "Ajuste",
};

// Valor com sinal como aparece na lista: resgate sempre negativo, ajuste já vem com sinal.
function displayCents(movement: InvestmentMovementView): number {
  return movement.kind === "withdrawal" ? -movement.amountCents : movement.amountCents;
}

interface InvestmentHistoryProps {
  movements: InvestmentMovementView[];
  today: IsoDate;
  onEditMovement: (movement: InvestmentMovementView) => void;
}

export function InvestmentHistory({ movements, today, onEditMovement }: InvestmentHistoryProps) {
  const [open, setOpen] = useState(false);
  if (movements.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 border-t border-border pt-2">
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
          {open ? "Esconder histórico" : `Ver histórico (${movements.length})`}
          <ChevronDownIcon
            aria-hidden="true"
            className={`size-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-border">
          {movements.map((movement) => (
            <HistoryItem key={movement.id} movement={movement} today={today} onEdit={() => onEditMovement(movement)} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HistoryItem({
  movement,
  today,
  onEdit,
}: {
  movement: InvestmentMovementView;
  today: IsoDate;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const label = KIND_LABEL[movement.kind];
  const cents = displayCents(movement);
  const isEditable = movement.kind !== "adjustment";
  const description = `${label} em ${formatMovementDate(movement.date, today)}`;

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteInvestmentMovement(movement.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toastWithUndo(`${DELETED_LABEL[movement.kind]} de ${formatCentsToBrl(Math.abs(cents))} excluído.`, () =>
        restoreFinanceItem("investment_movement", movement.id),
      );
    });
  };

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-2 text-xs" aria-busy={isPending}>
      <p className="min-w-0 truncate">
        <span className="font-medium text-foreground">{label}</span>{" "}
        <span className="text-muted-foreground">{formatMovementDate(movement.date, today)}</span>
      </p>
      <span className={`text-right font-mono tabular-nums ${cents > 0 ? "text-emerald-400" : "text-foreground"}`}>
        {signedBrl(cents)}
      </span>

      <p className="min-w-0 truncate text-muted-foreground" title={movement.note ?? undefined}>
        {movement.note}
      </p>
      <div className="-mr-1.5 flex justify-end gap-0.5">
        {isEditable && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            disabled={isPending}
            aria-label={`Editar: ${description}`}
            className="size-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <PencilIcon className="size-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={`Excluir: ${description}`}
          className="size-8 p-0 text-muted-foreground hover:text-rose-400"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>
    </li>
  );
}
