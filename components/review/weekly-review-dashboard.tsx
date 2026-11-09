"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckSquareIcon,
  ChevronRightIcon,
  ClockIcon,
  DollarSignIcon,
  HistoryIcon,
  InboxIcon,
  LaptopIcon,
  LightbulbIcon,
  ListTodoIcon,
  Loader2Icon,
  SaveIcon,
  SparklesIcon,
} from "lucide-react";
import { toast } from "sonner";

import { saveWeeklyReviewAction } from "@/lib/actions/weekly-review";
import type { WeeklyReviewData } from "@/lib/data/weekly-review";
import { formatCentsToBrl } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface WeeklyReviewDashboardProps {
  initialData: WeeklyReviewData;
}

const CHECKLIST_STEPS = [
  {
    key: "inbox",
    title: "Esvaziar a Caixa de Entrada",
    description: "Processe tudo o que capturou ao longo da semana e esvazie o inbox.",
    icon: InboxIcon,
    href: "/entrada",
    linkText: "Abrir Caixa de Entrada",
  },
  {
    key: "late_tasks",
    title: "Revisar Tarefas Atrasadas",
    description: "Reprograme ou elimine pendências que ficaram para trás.",
    icon: AlertTriangleIcon,
    href: "/hoje",
    linkText: "Ver Tarefas",
  },
  {
    key: "upcoming_week",
    title: "Planejar a Próxima Semana",
    description: "Defina as principais prioridades e tarefas dos próximos 7 dias.",
    icon: ListTodoIcon,
    href: "/hoje",
    linkText: "Ver Visão Semana",
  },
  {
    key: "calendar",
    title: "Olhar a Agenda",
    description: "Alinhe compromissos pessoais e da SES no Google Agenda.",
    icon: CalendarIcon,
    href: "/agenda",
    linkText: "Abrir Agenda",
  },
  {
    key: "content_marketing",
    title: "Conteúdo e Marketing (Trust Care)",
    description: "Revise ideias de Reels, Carrosséis e cronograma da assistência.",
    icon: LightbulbIcon,
    href: "/financas?tab=notebooks",
    linkText: "Ver Vitrine & Estoque",
  },
  {
    key: "finances",
    title: "Fechar Resumo Financeiro",
    description: "Confira as despesas, receitas e fluxo de caixa da semana.",
    icon: DollarSignIcon,
    href: "/financas",
    linkText: "Abrir Finanças",
  },
];

export function WeeklyReviewDashboard({ initialData }: WeeklyReviewDashboardProps) {
  const [isPending, startTransition] = useTransition();

  // Estado do checklist
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const raw = initialData.reviewRecord?.checklist;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as Record<string, boolean>;
    }
    return {};
  });

  const [notes, setNotes] = useState<string>(initialData.reviewRecord?.notes ?? "");
  const [isCompleted, setIsCompleted] = useState<boolean>(initialData.isCompleted);
  const [activeTab, setActiveTab] = useState<"review" | "history">("review");

  // Progresso do checklist
  const progress = useMemo(() => {
    let completed = 0;
    for (const step of CHECKLIST_STEPS) {
      if (checklist[step.key]) completed += 1;
    }
    const percent = Math.round((completed / CHECKLIST_STEPS.length) * 100);
    return { completed, total: CHECKLIST_STEPS.length, percent };
  }, [checklist]);

  const handleToggleStep = (key: string) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = (markCompleted = false) => {
    startTransition(async () => {
      const res = await saveWeeklyReviewAction({
        week_start: initialData.weekStart,
        checklist,
        notes: notes.trim() || null,
        completed: markCompleted || isCompleted,
      });

      if (res.ok) {
        if (markCompleted) {
          setIsCompleted(true);
          toast.success("Parabéns! Revisão semanal concluída com sucesso!");
        } else {
          toast.success("Rascunho da revisão salvo.");
        }
      } else {
        toast.error(res.error);
      }
    });
  };

  const handleReopen = () => {
    startTransition(async () => {
      const res = await saveWeeklyReviewAction({
        week_start: initialData.weekStart,
        checklist,
        notes: notes.trim() || null,
        completed: false,
      });

      if (res.ok) {
        setIsCompleted(false);
        toast.success("Revisão reaberta para edição.");
      } else {
        toast.error(res.error);
      }
    });
  };

  // Formatação da data da semana
  const weekLabel = useMemo(() => {
    const parts = initialData.weekStart.split("-");
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "America/Cuiaba",
    });
  }, [initialData.weekStart]);

  return (
    <div className="space-y-6 px-4 py-4 md:px-6 max-w-5xl mx-auto">
      {/* Topo: Título, Status e Alternador de Abas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider">
            <CheckSquareIcon className="size-4" />
            <span>Fechamento de Domingo</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Revisão Semanal
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Semana iniciada em <span className="font-semibold text-foreground">{weekLabel}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-muted/40 p-1 border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("review")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                activeTab === "review"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Revisão Atual
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "history"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HistoryIcon className="size-3.5" />
              Histórico ({initialData.recentHistory.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === "review" ? (
        <div className="space-y-6">
          {/* Card de Progresso */}
          <div className="rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-11 items-center justify-center rounded-2xl border ${
                    isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-primary/30 bg-primary/10 text-primary"
                  }`}
                >
                  {isCompleted ? <CheckCircle2Icon className="size-6" /> : <SparklesIcon className="size-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {isCompleted ? "Revisão Concluída!" : "Revisão da Semana em Andamento"}
                    </span>
                    <Badge
                      variant={isCompleted ? "default" : "secondary"}
                      className={
                        isCompleted
                          ? "bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {progress.completed} de {progress.total} concluídos ({progress.percent}%)
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isCompleted
                      ? "Semana finalizada com clareza. Você está pronto para os próximos desafios."
                      : "Siga o checklist passo a passo para esvaziar a mente e alinhar prioridades."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(false)}
                  disabled={isPending}
                  className="text-xs gap-1.5"
                >
                  <SaveIcon className="size-3.5" />
                  Salvar Rascunho
                </Button>
                {isCompleted ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleReopen}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reabrir Edição
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSave(true)}
                    disabled={isPending}
                    className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {isPending ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2Icon className="size-3.5" />
                    )}
                    Concluir Revisão
                  </Button>
                )}
              </div>
            </div>

            {/* Barra de Progresso Visual */}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className={`h-full transition-all duration-500 ${
                  isCompleted ? "bg-emerald-500" : "bg-primary"
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>

          {/* O Checklist Guiado de 6 Passos */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Passos da Revisão Guiada
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {/* Passo 1: Caixa de Entrada */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  checklist.inbox
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : "border-border/70 bg-card/60 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="step-inbox"
                      checked={Boolean(checklist.inbox)}
                      onChange={() => handleToggleStep("inbox")}
                      className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="step-inbox"
                        className={`text-sm font-semibold cursor-pointer ${
                          checklist.inbox ? "text-emerald-300 line-through" : "text-foreground"
                        }`}
                      >
                        1. Esvaziar a Caixa de Entrada
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Processe notas rápidas, links e mensagens soltas e transforme em tarefas ou arquive.
                      </p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                          {initialData.openInboxCount} {initialData.openInboxCount === 1 ? "item pendente" : "itens pendentes"}
                        </span>
                        <Link
                          href="/entrada"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Ir para Caixa de Entrada
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 2: Tarefas Atrasadas */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  checklist.late_tasks
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : "border-border/70 bg-card/60 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="step-late"
                      checked={Boolean(checklist.late_tasks)}
                      onChange={() => handleToggleStep("late_tasks")}
                      className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="step-late"
                        className={`text-sm font-semibold cursor-pointer ${
                          checklist.late_tasks ? "text-emerald-300 line-through" : "text-foreground"
                        }`}
                      >
                        2. Revisar Tarefas Atrasadas
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Reprograme para a próxima semana ou descarte o que perdeu o sentido.
                      </p>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {initialData.lateTasks.length === 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2Icon className="size-3" />
                            Nenhuma tarefa atrasada!
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-mono text-rose-400 border border-rose-500/30">
                            <AlertTriangleIcon className="size-3" />
                            {initialData.lateTasks.length} {initialData.lateTasks.length === 1 ? "tarefa atrasada" : "tarefas atrasadas"}
                          </span>
                        )}
                        <Link
                          href="/hoje"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Revisar no Hoje
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>

                      {initialData.lateTasks.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {initialData.lateTasks.slice(0, 3).map((t) => (
                            <div key={t.id} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full bg-rose-400" />
                              <span className="font-medium text-foreground">{t.title}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">({t.due_date})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 3: Planejar Próxima Semana */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  checklist.upcoming_week
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : "border-border/70 bg-card/60 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="step-upcoming"
                      checked={Boolean(checklist.upcoming_week)}
                      onChange={() => handleToggleStep("upcoming_week")}
                      className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="step-upcoming"
                        className={`text-sm font-semibold cursor-pointer ${
                          checklist.upcoming_week ? "text-emerald-300 line-through" : "text-foreground"
                        }`}
                      >
                        3. Planejar as Prioridades dos Próximos 7 Dias
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Defina suas entregas prioritárias e distribua na semana.
                      </p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                          {initialData.upcomingTasks.length} {initialData.upcomingTasks.length === 1 ? "tarefa agendada" : "tarefas agendadas"}
                        </span>
                        <Link
                          href="/hoje"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Ver Visão da Semana
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 4: Olhar a Agenda */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  checklist.calendar
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : "border-border/70 bg-card/60 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="step-calendar"
                      checked={Boolean(checklist.calendar)}
                      onChange={() => handleToggleStep("calendar")}
                      className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="step-calendar"
                        className={`text-sm font-semibold cursor-pointer ${
                          checklist.calendar ? "text-emerald-300 line-through" : "text-foreground"
                        }`}
                      >
                        4. Olhar a Agenda (Google Calendar)
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Confira os horários das reuniões da SES e compromissos pessoais, bloqueando tempo para foco.
                      </p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <Link
                          href="/agenda"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Abrir Agenda Semanal
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 5: Conteúdo e Marketing (Trust Care) */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  checklist.content_marketing
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : "border-border/70 bg-card/60 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="step-content"
                      checked={Boolean(checklist.content_marketing)}
                      onChange={() => handleToggleStep("content_marketing")}
                      className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                    />
                    <div>
                      <label
                        htmlFor="step-content"
                        className={`text-sm font-semibold cursor-pointer ${
                          checklist.content_marketing ? "text-emerald-300 line-through" : "text-foreground"
                        }`}
                      >
                        5. Ideias de Conteúdo & Estoque de Notebooks
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Revise postagens para o Instagram, notebooks anunciados e peças a providenciar.
                      </p>

                      <div className="mt-2.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                          {initialData.contentIdeasCount} ideias de conteúdo
                        </span>
                        <Link
                          href="/financas?tab=notebooks"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Ver Vitrine de Notebooks
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Passo 6: Resumo Financeiro */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  checklist.finances
                    ? "border-emerald-500/30 bg-emerald-950/10"
                    : "border-border/70 bg-card/60 hover:border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="step-finances"
                      checked={Boolean(checklist.finances)}
                      onChange={() => handleToggleStep("finances")}
                      className="mt-1 size-4 rounded border-border accent-emerald-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="step-finances"
                        className={`text-sm font-semibold cursor-pointer ${
                          checklist.finances ? "text-emerald-300 line-through" : "text-foreground"
                        }`}
                      >
                        6. Fechar Resumo Financeiro do Mês
                      </label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Suba o extrato .OFX da semana, confira as contas pagas e o resultado operacional.
                      </p>

                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="rounded-lg bg-muted/30 p-2">
                          <span className="text-[10px] text-muted-foreground">Entradas do Mês:</span>
                          <div className="font-mono font-semibold text-emerald-400">
                            {formatCentsToBrl(initialData.finance.incomeCents)}
                          </div>
                        </div>

                        <div className="rounded-lg bg-muted/30 p-2">
                          <span className="text-[10px] text-muted-foreground">Saídas do Mês:</span>
                          <div className="font-mono font-semibold text-rose-400">
                            {formatCentsToBrl(initialData.finance.expenseCents)}
                          </div>
                        </div>

                        <div className="rounded-lg bg-muted/30 p-2">
                          <span className="text-[10px] text-muted-foreground">Saldo Líquido:</span>
                          <div
                            className={`font-mono font-bold ${
                              initialData.finance.balanceCents >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {formatCentsToBrl(initialData.finance.balanceCents)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5">
                        <Link
                          href="/financas"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          Abrir Módulo de Finanças
                          <ArrowRightIcon className="size-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Anotações e Reflexão da Semana */}
          <div className="rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur-sm space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="review-notes" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <SparklesIcon className="size-3.5 text-primary" />
                Reflexão da Semana & Anotações
              </Label>
              <span className="text-[10px] text-muted-foreground">Salvo no histórico</span>
            </div>
            <Textarea
              id="review-notes"
              rows={4}
              placeholder="O que funcionou muito bem nesta semana? O que posso ajustar na próxima? Notas de bancada, hábitos, finanças ou metas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* Botões Finais de Ação */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isPending}
              className="text-xs gap-1.5"
            >
              <SaveIcon className="size-3.5" />
              Salvar Rascunho
            </Button>
            {!isCompleted ? (
              <Button
                type="button"
                size="sm"
                onClick={() => handleSave(true)}
                disabled={isPending}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle2Icon className="size-3.5" />
                )}
                Concluir Revisão Semanal
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleReopen}
                disabled={isPending}
                className="text-xs"
              >
                Reabrir Revisão
              </Button>
            )}
          </div>
        </div>
      ) : (
        /* ABA DE HISTÓRICO DAS REVISÕES ANTERIORES */
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            Registro das últimas revisões semanais realizadas e suas respectivas anotações.
          </div>

          {initialData.recentHistory.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card/60 p-8 text-center text-xs text-muted-foreground">
              Nenhuma revisão finalizada anteriormente. Conclua sua primeira revisão para inaugurar o histórico!
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {initialData.recentHistory.map((rev) => {
                const parts = rev.week_start.split("-");
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                const label = d.toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Cuiaba",
                });

                const rawChecklist = rev.checklist as Record<string, boolean> | null;
                const completedSteps = rawChecklist
                  ? Object.values(rawChecklist).filter(Boolean).length
                  : 0;

                return (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-border/70 bg-card/60 p-4 shadow-sm backdrop-blur-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">Semana de {label}</span>
                        {rev.completed_at ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0">
                            Concluída
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 text-amber-400">
                            Rascunho
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {completedSteps} de 6 passos cumpridos
                      </span>
                    </div>

                    {rev.notes ? (
                      <div className="rounded-lg bg-muted/20 p-2.5 text-xs text-muted-foreground whitespace-pre-line border border-border/40">
                        {rev.notes}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">Sem anotações registradas.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
