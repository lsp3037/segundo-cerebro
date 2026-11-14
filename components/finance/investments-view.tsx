"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PiggyBankIcon,
  PercentIcon,
  PlusIcon,
  ScaleIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { deleteInvestment } from "@/lib/actions/finance-investments";
import { restoreFinanceItem } from "@/lib/actions/finance-restore";
import type { IsoDate } from "@/lib/dates";
import type { NonBusinessReason } from "@/lib/finance/investments";
import type {
  CdiInfo,
  InvestmentMovementView,
  InvestmentView,
  InvestmentsData,
} from "@/lib/finance/investments-data";
import { formatCentsToBrl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { monthNameLong } from "./getting-started";
import { describeRate, formatPercent, signedBrl } from "./investment-format";
import { InvestmentHistory } from "./investment-history";
import {
  InvestmentMovementDialog,
  type MovementDialogTarget,
  type MovementKindInput,
} from "./investment-movement-dialog";
import { InvestmentRateDialog } from "./investment-rate-dialog";
import { InvestmentRateHistory } from "./investment-rate-history";
import { InvestmentReconcileDialog } from "./investment-reconcile-dialog";
import { toastWithUndo } from "./pay-toggle";
import { AnimatedBrl } from "./transitions";

interface InvestmentsViewProps {
  data: InvestmentsData | null;
  month: string; // AAAA-MM
  memberFilter: string | null;
  onNewInvestment: () => void;
  onEditInvestment: (investment: InvestmentView) => void;
}

const NON_BUSINESS_LABEL: Record<NonBusinessReason, string> = {
  weekend: "fim de semana",
  holiday: "feriado",
};

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

// "2026-11-12" → "12/11"
function formatDayMonth(iso: IsoDate): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// ---------------------------------------------------------------------------
// Tela
// ---------------------------------------------------------------------------

export function InvestmentsView({ data, month, memberFilter, onNewInvestment, onEditInvestment }: InvestmentsViewProps) {
  if (!data) return <InvestmentsUnavailable />;
  if (data.error) return <InvestmentsError />;

  const isEmpty = data.investments.length === 0;
  if (isEmpty && !memberFilter) return <InvestmentsEmpty onNewInvestment={onNewInvestment} />;

  const monthLabel = monthNameLong(month);
  return (
    <div className="space-y-6">
      {!isEmpty && <InvestmentsTop data={data} monthLabel={monthLabel} />}
      <CdiLine cdi={data.cdi} />

      <section className="space-y-3" aria-labelledby="investments-list-title">
        <div>
          <h3 id="investments-list-title" className="text-sm font-medium text-foreground">Seus investimentos</h3>
          <p className="text-xs text-muted-foreground">Valores antes do imposto, como no app do banco.</p>
        </div>

        {isEmpty ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            Nenhum investimento para {memberFilter}.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.investments.map((investment) => (
              <InvestmentCard
                key={investment.id}
                investment={investment}
                monthLabel={monthLabel}
                today={data.today}
                cdiDailyPercent={data.cdi.dailyPercent}
                onEdit={() => onEditInvestment(investment)}
              />
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Guardar e resgatar aqui não mexe nos lançamentos nem no saldo dos bancos.
        </p>
      </section>
    </div>
  );
}

function InvestmentsTop({ data, monthLabel }: { data: InvestmentsData; monthLabel: string }) {
  const { totals } = data;
  const netDepositedCents = totals.depositedCents - totals.withdrawnCents;
  return (
    <section className="space-y-3" aria-label="Resumo dos investimentos">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">Valor hoje</p>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          <AnimatedBrl cents={totals.valueCents} resetKey={data.today} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {totals.withdrawnCents > 0 ? (
            <>
              Você colocou <span className="tabular-nums text-foreground">{formatCentsToBrl(totals.depositedCents)}</span> e
              resgatou <span className="tabular-nums text-foreground">{formatCentsToBrl(totals.withdrawnCents)}</span>.
            </>
          ) : (
            <>
              Você colocou <span className="tabular-nums text-foreground">{formatCentsToBrl(netDepositedCents)}</span> no total.
            </>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TodayCard
          yieldTodayCents={totals.yieldTodayCents}
          nextCreditCents={totals.nextCreditCents}
          reason={data.todayIsBusinessDay ? null : data.todayReason}
          resetKey={data.today}
        />
        <YieldCard title={`Rendimento em ${monthLabel}`} cents={totals.yieldMonthCents} resetKey={data.today} />
        <YieldCard title="Rendimento total" cents={totals.yieldTotalCents} resetKey={data.today} />
      </div>
    </section>
  );
}

function TodayCard({
  yieldTodayCents,
  nextCreditCents,
  reason,
  resetKey,
}: {
  yieldTodayCents: number;
  nextCreditCents: number;
  reason: NonBusinessReason | null;
  resetKey: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">Rendeu hoje</p>
      {reason ? (
        <p className="mt-1 text-sm font-medium text-foreground">Hoje não rende ({NON_BUSINESS_LABEL[reason]})</p>
      ) : (
        <div className="mt-1 text-xl font-semibold text-emerald-400">
          <AnimatedBrl cents={yieldTodayCents} signed resetKey={resetKey} />
        </div>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        Próximo crédito: cerca de <span className="tabular-nums">{formatCentsToBrl(nextCreditCents)}</span>
      </p>
    </div>
  );
}

function YieldCard({ title, cents, resetKey }: { title: string; cents: number; resetKey: string }) {
  const tone = cents > 0 ? "text-emerald-400" : cents < 0 ? "text-rose-400" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <div className={`mt-1 text-xl font-semibold ${tone}`}>
        <AnimatedBrl cents={cents} signed resetKey={resetKey} />
      </div>
    </div>
  );
}

function CdiLine({ cdi }: { cdi: CdiInfo }) {
  if (cdi.annualPercent === null || cdi.lastDate === null) {
    return (
      <p className="text-xs text-amber-400">
        Ainda não consegui buscar o CDI (taxa de referência dos bancos) no Banco Central. Tente de novo mais tarde.
      </p>
    );
  }
  return (
    <div className="space-y-0.5 text-xs">
      <p className="text-foreground">
        CDI de hoje: <span className="tabular-nums">{formatPercent(cdi.annualPercent, 2)}% ao ano</span>{" "}
        <span className="text-muted-foreground">(Banco Central, {formatDayMonth(cdi.lastDate)})</span>
      </p>
      <p className="text-muted-foreground">O CDI é a taxa de referência dos bancos. O app busca sozinho todo dia.</p>
      {cdi.stale && (
        <p role="status" className="text-amber-400">
          Não consegui atualizar o CDI; usando o de {formatDayMonth(cdi.lastDate)}.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartão de cada investimento
// ---------------------------------------------------------------------------

// Diálogos de um cartão: "Guardei"/"Resgatei" (novo ou edição pelo histórico), "Acertar com o app" e "Mudar taxa".
// O alvo do movimento fica guardado ao fechar, para o diálogo não sumir no meio da animação.
function useCardDialogs(investment: InvestmentView) {
  const [movementTarget, setMovementTarget] = useState<MovementDialogTarget | null>(null);
  const [isMovementOpen, setMovementOpen] = useState(false);
  const [isReconcileOpen, setReconcileOpen] = useState(false);
  const [isRateOpen, setRateOpen] = useState(false);

  const openMovement = (kind: MovementKindInput, movement: InvestmentMovementView | null = null) => {
    setMovementTarget({ investment, kind, movement });
    setMovementOpen(true);
  };

  const editMovement = (movement: InvestmentMovementView) => {
    if (movement.kind === "adjustment") return;
    openMovement(movement.kind, movement);
  };

  return {
    movementTarget,
    isMovementOpen,
    setMovementOpen,
    isReconcileOpen,
    setReconcileOpen,
    isRateOpen,
    setRateOpen,
    openMovement,
    editMovement,
  };
}

function InvestmentCard({
  investment,
  monthLabel,
  today,
  cdiDailyPercent,
  onEdit,
}: {
  investment: InvestmentView;
  monthLabel: string;
  today: IsoDate;
  cdiDailyPercent: number | null;
  onEdit: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const dialogs = useCardDialogs(investment);
  const { summary } = investment;
  const rate = summary.currentRate ?? investment.rates[investment.rates.length - 1] ?? null;

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteInvestment(investment.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toastWithUndo(`${investment.name} foi removido.`, () => restoreFinanceItem("investment", investment.id));
    });
  };

  return (
    <article className="rounded-lg border border-border bg-card p-4" aria-busy={isPending}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-medium text-foreground">{investment.name}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {investment.ownerLabel ? `Responsável: ${investment.ownerLabel}` : "Sem responsável"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{describeRate(rate)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Mais opções de ${investment.name}`}
              className="size-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
              disabled={isPending}
            >
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => dialogs.setReconcileOpen(true)}>
              <ScaleIcon className="size-4" />
              <span>Acertar com o app</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => dialogs.setRateOpen(true)}>
              <PercentIcon className="size-4" />
              <span>Mudar taxa</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onEdit}>
              <PencilIcon className="size-4" />
              <span>Editar</span>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={handleDelete}>
              <Trash2Icon className="size-4" />
              <span>Remover</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 text-xl font-semibold text-foreground">
        <AnimatedBrl cents={summary.valueCents} resetKey={investment.id} />
      </div>
      <p className="text-xs text-muted-foreground">Valor hoje</p>

      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        <CardFact label="Rendeu hoje">
          {summary.todayIsBusinessDay || !summary.todayReason ? (
            <span className="text-emerald-400">{signedBrl(summary.yieldTodayCents)}</span>
          ) : (
            <span>Hoje não rende ({NON_BUSINESS_LABEL[summary.todayReason]})</span>
          )}
        </CardFact>
        <CardFact label="Próximo crédito">cerca de {formatCentsToBrl(summary.nextCreditCents)}</CardFact>
        <CardFact label={`Rendimento em ${monthLabel}`}>{signedBrl(summary.yieldMonthCents)}</CardFact>
        <CardFact label="Rendimento total">{signedBrl(summary.yieldTotalCents)}</CardFact>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogs.openMovement("deposit")}
          disabled={isPending}
          className="h-8 gap-1.5 text-xs active:scale-[0.98]"
        >
          <ArrowDownToLineIcon className="size-3.5" aria-hidden="true" />
          Guardei
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dialogs.openMovement("withdrawal")}
          disabled={isPending}
          className="h-8 gap-1.5 text-xs active:scale-[0.98]"
        >
          <ArrowUpFromLineIcon className="size-3.5" aria-hidden="true" />
          Resgatei
        </Button>
      </div>

      {investment.notes && <p className="mt-3 text-xs whitespace-pre-line text-muted-foreground">{investment.notes}</p>}

      <div className="mt-4 border-t border-border pt-2">
        <InvestmentHistory movements={investment.movements} today={today} onEditMovement={dialogs.editMovement} />
        <InvestmentRateHistory investmentId={investment.id} rates={investment.rates} currentRate={summary.currentRate} />
      </div>

      <InvestmentMovementDialog
        open={dialogs.isMovementOpen}
        onOpenChange={dialogs.setMovementOpen}
        target={dialogs.movementTarget}
        today={today}
      />
      <InvestmentReconcileDialog
        open={dialogs.isReconcileOpen}
        onOpenChange={dialogs.setReconcileOpen}
        investment={investment}
      />
      <InvestmentRateDialog
        open={dialogs.isRateOpen}
        onOpenChange={dialogs.setRateOpen}
        investment={investment}
        cdiDailyPercent={cdiDailyPercent}
        today={today}
      />
    </article>
  );
}

function CardFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Estados
// ---------------------------------------------------------------------------

function InvestmentsEmpty({ onNewInvestment }: { onNewInvestment: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <PiggyBankIcon className="size-6 text-muted-foreground" aria-hidden="true" />
      <div className="max-w-md space-y-1">
        <p className="text-sm font-medium text-foreground">Nenhum investimento cadastrado</p>
        <p className="text-xs text-muted-foreground">
          Cadastre o Cofrinho (ou outro investimento) com quanto você tem lá hoje. O app calcula sozinho quanto rende em
          cada dia útil, usando o CDI, a taxa de referência dos bancos.
        </p>
      </div>
      <Button size="sm" onClick={onNewInvestment} className="h-8 gap-1.5 text-xs">
        <PlusIcon className="size-3.5" />
        Cadastrar investimento
      </Button>
    </div>
  );
}

function InvestmentsError() {
  const router = useRouter();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-4 py-8 text-center">
      <p className="text-sm text-foreground">Não foi possível carregar os investimentos. Tente de novo.</p>
      <Button variant="outline" size="sm" onClick={() => router.refresh()} className="h-8 text-xs">
        Tentar de novo
      </Button>
    </div>
  );
}

function InvestmentsUnavailable() {
  return (
    <div aria-busy="true" className="space-y-3">
      <div className="h-28 animate-pulse rounded-lg border border-border bg-card motion-reduce:animate-none" />
      <p className="text-xs text-muted-foreground">Carregando os investimentos. Se demorar, atualize a página.</p>
    </div>
  );
}
