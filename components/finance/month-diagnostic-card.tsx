"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";

import {
  generateMonthDiagnostic,
  type MonthDiagnosticResult,
} from "@/lib/actions/finance-diagnostic";
import { Button } from "@/components/ui/button";
import type { LedgerType } from "./meta";
import { UiGenerationReveal } from "./ui-generation-reveal";

interface MonthDiagnosticCardProps {
  month: string;
  ledger: LedgerType;
  member: string | null;
}

const DIAGNOSTIC_STEPS = [
  "Lendo lançamentos",
  "Calculando pendências",
  "Comparando categorias",
  "Montando resumo",
];

export function MonthDiagnosticCard({
  month,
  ledger,
  member,
}: MonthDiagnosticCardProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MonthDiagnosticResult | null>(null);
  const [revealKey, setRevealKey] = useState(0);

  const handleGenerate = () => {
    startTransition(async () => {
      const res = await generateMonthDiagnostic({ month, ledger, member });
      if (res.ok) {
        setResult(res.data);
        setRevealKey((k) => k + 1);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Diagnóstico do mês
          </h3>
          <p className="text-xs text-muted-foreground">
            Leitura sob demanda de saldo, pendências e peso das categorias
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={isPending}
          className="h-8 gap-1.5 text-xs"
        >
          {isPending ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <SparklesIcon className="size-3.5" />
          )}
          <span>{result ? "Atualizar diagnóstico" : "Gerar diagnóstico do mês"}</span>
        </Button>
      </div>

      {result && (
        <UiGenerationReveal
          triggerKey={revealKey}
          variant="auto"
          mode="skeleton-texts"
          duration={1500}
          steps={DIAGNOSTIC_STEPS}
          done="Diagnóstico pronto"
          className="mt-4 rounded-md border border-border bg-background/60 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-foreground">{result.headline}</p>
            <span className="rounded border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {result.source === "ai"
                ? "Gerado com IA"
                : "Análise local · IA desativada em Finanças"}
            </span>
          </div>

          <p className="mt-1 text-xs text-muted-foreground">{result.summary}</p>

          <ul className="mt-3 space-y-1.5 text-xs text-foreground/90">
            {result.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
            <strong className="font-medium text-foreground">Próximo passo:</strong>{" "}
            {result.actionTip}
          </div>
        </UiGenerationReveal>
      )}
    </section>
  );
}
