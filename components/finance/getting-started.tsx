"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface StartStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  actionLabel: string;
  onAction: () => void;
}

interface GettingStartedProps {
  title: string;
  description: string;
  steps: StartStep[];
  footer?: ReactNode;
}

// Passo a passo mostrado quando o mês ainda não tem nenhum lançamento.
// Substitui a tela cheia de "R$ 0,00": os números aparecem quando houver o que mostrar.
export function GettingStarted({ title, description, steps, footer }: GettingStartedProps) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextId = steps.find((s) => !s.done)?.id;
  const percent = Math.round((doneCount / steps.length) * 100);

  return (
    <section aria-labelledby="getting-started-title" className="mx-auto max-w-2xl py-4">
      <h2 id="getting-started-title" className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <div className="mt-4 flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
          aria-label="Passos concluídos"
          className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {doneCount} de {steps.length}
        </span>
      </div>

      <ol className="mt-4 space-y-2.5">
        {steps.map((step, idx) => {
          const isNext = step.id === nextId;
          return (
            <li
              key={step.id}
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3.5 sm:flex-nowrap ${
                isNext ? "border-foreground/25" : "border-border"
              }`}
            >
              <span
                aria-hidden
                className={`grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                  step.done
                    ? "border-emerald-500 bg-emerald-500 text-emerald-950"
                    : "border-border text-muted-foreground"
                }`}
              >
                {step.done ? <CheckIcon className="size-3.5" strokeWidth={3} /> : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className={`text-sm font-medium ${step.done ? "text-muted-foreground" : "text-foreground"}`}>
                  {step.title}
                  {step.done && <span className="sr-only"> (feito)</span>}
                </h3>
                <p className="text-[13px] text-muted-foreground">{step.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={isNext ? "default" : "outline"}
                onClick={step.onAction}
                className="ml-10 shrink-0 sm:ml-0"
              >
                {step.done ? "Ver" : step.actionLabel}
              </Button>
            </li>
          );
        })}
      </ol>

      {footer && <div className="mt-4 text-[13px] text-muted-foreground">{footer}</div>}
    </section>
  );
}

interface EmptyMonthProps {
  message: string;
  children: ReactNode;
}

// Mês vazio fora do Pessoal (Trust Care, Consolidado): uma frase e os botões para começar.
export function EmptyMonth({ message, children }: EmptyMonthProps) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  );
}

export function monthNameLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long" });
}
