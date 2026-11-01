"use client";

import { CalendarPlusIcon, ChevronLeftIcon, ChevronRightIcon, Loader2Icon, PlusIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncNow } from "@/lib/actions/events";
import { type IsoDate } from "@/lib/dates";
import type { Occurrence } from "@/lib/events-expand";
import { cn } from "@/lib/utils";
import { type CalendarOption, type DialogState, EventDialog } from "./event-dialog";
import { MonthGrid } from "./month-grid";
import { TimeGrid } from "./time-grid";

export type AgendaViewName = "dia" | "semana" | "mes";

const VIEWS: { value: AgendaViewName; label: string }[] = [
  { value: "dia", label: "Dia" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mês" },
];

export function AgendaView({
  view,
  label,
  days,
  month,
  prev,
  next,
  today,
  occurrences,
  calendars,
  defaultAreaId,
}: {
  view: AgendaViewName;
  label: string;
  days: IsoDate[];
  month: IsoDate;
  prev: IsoDate;
  next: IsoDate;
  today: IsoDate;
  occurrences: Occurrence[];
  calendars: CalendarOption[];
  defaultAreaId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [syncing, startSync] = useTransition();
  const connected = calendars.some((c) => c.sync_enabled);

  const href = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    return `${pathname}?${params}`;
  };

  const close = useCallback(() => setDialog(null), []);

  if (!connected) {
    return (
      <div className="mx-4 my-8 rounded-xl border border-dashed px-6 py-12 text-center md:mx-6">
        <CalendarPlusIcon className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Nenhuma agenda conectada</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {calendars.length > 0
            ? "Ligue pelo menos uma agenda em Configurações."
            : "Conecte sua conta Google para ver e editar seus compromissos aqui."}
        </p>
        <Button asChild className="mt-4">
          {calendars.length > 0 ? <Link href="/configuracoes#agenda">Abrir Configurações</Link> : <a href="/api/google/connect">Conectar Google Agenda</a>}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Visão" className="inline-flex rounded-lg border p-0.5">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              role="tab"
              aria-selected={v.value === view}
              href={href({ v: v.value })}
              scroll={false}
              className={cn(
                "flex h-7 items-center rounded-md px-3 text-sm",
                v.value === view ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" asChild aria-label="Anterior">
            <Link href={href({ d: prev })} scroll={false}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={href({ d: today })} scroll={false}>
              Hoje
            </Link>
          </Button>
          <Button variant="outline" size="icon-sm" asChild aria-label="Próximo">
            <Link href={href({ d: next })} scroll={false}>
              <ChevronRightIcon />
            </Link>
          </Button>
          <span className="ml-1 text-sm font-medium first-letter:uppercase">{label}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={syncing}
            title="Buscar mudanças no Google agora"
            onClick={() =>
              startSync(async () => {
                const result = await syncNow();
                if (!result.ok) toast.error(result.error);
                else if (result.data.errors) toast.error("Algumas agendas não sincronizaram. Veja Configurações.");
                else toast.success("Agenda atualizada.");
                router.refresh();
              })
            }
          >
            {syncing ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
            <span className="hidden sm:inline">Sincronizar</span>
          </Button>
          <Button size="sm" onClick={() => setDialog({ mode: "create", date: view === "mes" ? today : days[0] ?? today, minutes: 9 * 60 })}>
            <PlusIcon />
            Evento
          </Button>
        </div>
      </div>

      {view === "mes" ? (
        <MonthGrid
          month={month}
          today={today}
          occurrences={occurrences}
          onOpen={(o) => setDialog({ mode: "edit", eventId: o.eventId })}
          onCreate={(date, minutes) => setDialog({ mode: "create", date, minutes })}
        />
      ) : (
        <TimeGrid
          days={days}
          today={today}
          occurrences={occurrences}
          onOpen={(o) => setDialog({ mode: "edit", eventId: o.eventId })}
          onCreate={(date, minutes) => setDialog({ mode: "create", date, minutes })}
        />
      )}

      <EventDialog
        state={dialog}
        calendars={calendars}
        defaultAreaId={defaultAreaId}
        onClose={close}
        onSaved={() => {
          setDialog(null);
          router.refresh();
        }}
      />
    </div>
  );
}
