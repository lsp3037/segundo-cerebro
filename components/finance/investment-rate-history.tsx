"use client";

import { useState, useTransition } from "react";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { deleteInvestmentRate, saveInvestmentRate } from "@/lib/actions/finance-investments";
import type { RateEntry } from "@/lib/finance/investments";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { describeRate, formatFullDate } from "./investment-format";
import { rateEntryToInput } from "./investment-rate-fields";
import { toastWithUndo } from "./pay-toggle";

interface InvestmentRateHistoryProps {
  investmentId: string;
  // Ordenadas por `from` (mais antiga primeiro), como vêm do servidor.
  rates: RateEntry[];
  currentRate: RateEntry | null;
}

// "Histórico de taxas": cada taxa com o dia em que começou a valer. A única taxa não pode ser removida.
export function InvestmentRateHistory({ investmentId, rates, currentRate }: InvestmentRateHistoryProps) {
  const [open, setOpen] = useState(false);
  if (rates.length === 0) return null;

  const canRemove = rates.length > 1;
  const newestFirst = [...rates].reverse();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground">
          {open ? "Esconder histórico de taxas" : `Histórico de taxas (${rates.length})`}
          <ChevronDownIcon
            aria-hidden="true"
            className={`size-3.5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="divide-y divide-border">
          {newestFirst.map((entry) => (
            <RateItem
              key={entry.from}
              investmentId={investmentId}
              entry={entry}
              isCurrent={currentRate?.from === entry.from}
              canRemove={canRemove}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RateItem({
  investmentId,
  entry,
  isCurrent,
  canRemove,
}: {
  investmentId: string;
  entry: RateEntry;
  isCurrent: boolean;
  canRemove: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const since = `desde ${formatFullDate(entry.from)}`;
  const description = describeRate(entry);

  const handleDelete = () => {
    const { from } = entry;
    const rate = rateEntryToInput(entry);
    startTransition(async () => {
      const res = await deleteInvestmentRate({ investmentId, from });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toastWithUndo("Taxa removida.", () => saveInvestmentRate({ investmentId, from, rate }));
    });
  };

  return (
    <li className="flex items-center gap-3 py-2 text-xs" aria-busy={isPending}>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground">
          {since}
          {isCurrent && <span className="ml-1.5 text-emerald-400">em vigor</span>}
        </p>
        <p className="text-foreground">{description}</p>
      </div>
      {canRemove && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={isPending}
          aria-label={`Remover taxa ${since}: ${description}`}
          className="-mr-1.5 size-8 shrink-0 p-0 text-muted-foreground hover:text-rose-400"
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      )}
    </li>
  );
}
