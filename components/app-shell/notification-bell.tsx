"use client";

import {
  AlertTriangleIcon,
  CalendarArrowUpIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  InboxIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toggleTransactionPaid } from "@/lib/actions/finance-family";
import { markNotificationsRead } from "@/lib/actions/notifications";
import { setTaskStatus, updateTask } from "@/lib/actions/tasks";
import { todayIso } from "@/lib/dates";
import {
  type AppNotification,
  NOTIFICATION_FILTERS,
  NOTIFICATION_GROUPS,
  type NotificationCategory,
  type NotificationTone,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const POLL_MS = 60_000;
const LEAVE_MS = 260;

const ICONS = {
  calendar: CalendarDaysIcon,
  clock: ClockIcon,
  alert: AlertTriangleIcon,
  wallet: WalletIcon,
  inbox: InboxIcon,
} as const;

const TONES: Record<NotificationTone, string> = {
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  gray: "bg-muted text-muted-foreground",
};

// Som de aviso do componente original (duas notas curtas, Web Audio).
function playChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  [880, 1318.5].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = now + i * 0.13;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  });
}

const ACTION_LABEL = { "move-today": "Hoje", complete: "Concluir", pay: "Pagar" } as const;
const DONE_MESSAGE = { "move-today": "Movida para hoje.", complete: "Tarefa concluída.", pay: "Conta marcada como paga." } as const;

// Sino da barra superior: avisos de agenda, tarefas, contas e Caixa de Entrada.
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationCategory | "todas">("todas");
  const [leaving, setLeaving] = useState<Set<string>>(() => new Set());
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const known = useRef<Set<string> | null>(null);
  const lastUnread = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [ring, setRing] = useState(0);
  const [badgeLabel, setBadgeLabel] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notificacoes", { cache: "no-store" });
      if (!res.ok) return;
      const { notifications } = (await res.json()) as { notifications: AppNotification[] };
      if (known.current) {
        const before = known.current;
        setFresh(new Set(notifications.filter((n) => !before.has(n.key)).map((n) => n.key)));
      }
      known.current = new Set(notifications.map((n) => n.key));
      setItems(notifications);

      // Chegou aviso novo não lido: o sino balança e toca (o som só depois do primeiro carregamento).
      const count = notifications.filter((n) => !n.read).length;
      if (count > 0) setBadgeLabel(count > 9 ? "9+" : String(count));
      if (count > (lastUnread.current ?? 0)) {
        setRing((r) => r + 1);
        if (lastUnread.current !== null && audio.current) {
          try {
            if (audio.current.state === "suspended") await audio.current.resume();
            playChime(audio.current);
          } catch {
            // Sem som disponível: fica só a animação.
          }
        }
      }
      lastUnread.current = count;
    } catch {
      // Sem conexão: tenta de novo no próximo ciclo.
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const visible = items?.filter((n) => !leaving.has(n.key)) ?? [];
  const unread = visible.filter((n) => !n.read).length;

  // O navegador só libera som depois de um clique ou toque na página.
  useEffect(() => {
    const unlock = () => {
      if (audio.current) return;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audio.current = new AC();
      } catch {
        // Sem Web Audio.
      }
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const label = unread > 0 ? (unread > 9 ? "9+" : String(unread)) : badgeLabel;

  async function markRead(keys: string[]) {
    if (keys.length === 0) return;
    setItems((list) => list?.map((n) => (keys.includes(n.key) ? { ...n, read: true } : n)) ?? null);
    const result = await markNotificationsRead(keys);
    if (!result.ok) {
      toast.error(result.error);
      load();
    }
  }

  function removeLater(key: string) {
    setTimeout(() => {
      setItems((list) => list?.filter((n) => n.key !== key) ?? null);
      setLeaving((set) => {
        const next = new Set(set);
        next.delete(key);
        return next;
      });
    }, LEAVE_MS);
  }

  async function runAction(n: AppNotification) {
    const action = n.action;
    if (!action) return;
    setLeaving((set) => new Set(set).add(n.key));

    const result =
      action.type === "move-today"
        ? await updateTask(action.taskId, { due_date: todayIso() })
        : action.type === "complete"
          ? await setTaskStatus(action.taskId, "done")
          : await toggleTransactionPaid(action.transactionId);

    if (!result.ok) {
      toast.error(result.error);
      setLeaving((set) => {
        const next = new Set(set);
        next.delete(n.key);
        return next;
      });
      return;
    }

    removeLater(n.key);
    router.refresh();
    toast(DONE_MESSAGE[action.type], {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const undo =
            action.type === "move-today"
              ? await updateTask(action.taskId, { due_date: action.previousDue })
              : action.type === "complete"
                ? await setTaskStatus(action.taskId, "todo")
                : await toggleTransactionPaid(action.transactionId);
          if (!undo.ok) toast.error(undo.error);
          router.refresh();
          load();
        },
      },
    });
  }

  const shown = (items ?? []).filter((n) => filter === "todas" || n.category === filter);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) load();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="nb-bell mx-1 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={unread > 0 ? `Notificações: ${unread} ${unread === 1 ? "nova" : "novas"}` : "Notificações"}
          title="Notificações"
        >
          <span key={ring} className={cn("nb-ring", ring > 0 && "is-ringing")}>
            <svg className="hi" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" aria-hidden="true">
              <path d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </span>
          <span className="t-badge" data-open={unread > 0 ? "true" : "false"} aria-hidden="true">
            <span className="t-badge-dot">
              <span key={label + "-" + ring} className="t-digit-group is-animating">
                {label.split("").map((ch, i) => (
                  <span className="t-digit" key={i}>
                    {ch}
                  </span>
                ))}
              </span>
            </span>
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[min(25rem,calc(100vw-1rem))] gap-0 overflow-hidden rounded-xl p-0">
        <header className="flex items-center gap-2 px-4 pt-3.5 pb-2.5">
          <h2 className="text-[15px] font-semibold">Notificações</h2>
          {unread > 0 && (
            <span className="rounded-full bg-red-500/15 px-2 py-px text-[11px] font-semibold text-red-600 dark:text-red-400">
              {unread === 1 ? "1 nova" : `${unread} novas`}
            </span>
          )}
          <button
            type="button"
            disabled={unread === 0}
            onClick={() => markRead(visible.filter((n) => !n.read).map((n) => n.key))}
            className="ml-auto rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Marcar todas como lidas
          </button>
        </header>

        <div role="tablist" aria-label="Filtrar avisos" className="flex gap-1 border-b px-3 pb-2.5">
          {NOTIFICATION_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                filter === f.value
                  ? "border-transparent bg-foreground font-medium text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="max-h-[min(32rem,calc(100vh-11rem))] overflow-y-auto p-1.5">
          {items === null ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Carregando avisos…</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-9 text-center">
              <CheckIcon className="mb-1 size-5 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">Tudo em dia</p>
              <p className="text-xs text-muted-foreground">Nenhum aviso pendente agora.</p>
            </div>
          ) : (
            NOTIFICATION_GROUPS.map((g) => {
              const rows = shown.filter((n) => n.group === g.value);
              if (rows.length === 0) return null;
              return (
                <section key={g.value}>
                  <h3 className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {g.label}
                  </h3>
                  {rows.map((n) => (
                    <NotificationRow
                      key={n.key}
                      n={n}
                      entering={fresh.has(n.key)}
                      leaving={leaving.has(n.key)}
                      onOpen={() => {
                        if (!n.read) markRead([n.key]);
                        setOpen(false);
                      }}
                      onAction={() => runAction(n)}
                    />
                  ))}
                </section>
              );
            })
          )}
        </div>

        <footer className="border-t p-1.5">
          <Link
            href="/hoje"
            onClick={() => setOpen(false)}
            className="block rounded-lg py-1.5 text-center text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Ver tela Hoje
          </Link>
        </footer>
      </PopoverContent>
    </Popover>
  );
}

function NotificationRow({
  n,
  entering,
  leaving,
  onOpen,
  onAction,
}: {
  n: AppNotification;
  entering: boolean;
  leaving: boolean;
  onOpen: () => void;
  onAction: () => void;
}) {
  const Icon = ICONS[n.icon];
  return (
    <div className="t-notif-item" data-enter={entering} data-leaving={leaving}>
      <div>
        <div className="relative grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/50">
          {!n.read && <span className="absolute top-1/2 left-0.5 size-1.5 -translate-y-1/2 rounded-full bg-blue-500" />}
          <span className={cn("flex size-8 items-center justify-center rounded-lg", TONES[n.tone])} aria-hidden="true">
            <Icon className="size-4" />
          </span>
          <Link href={n.href} onClick={onOpen} className="min-w-0 rounded-sm focus-visible:outline-2">
            <p className="text-sm leading-snug font-medium">
              {n.title}
              {!n.read && <span className="sr-only"> (não lido)</span>}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {n.urgent && <span className="font-medium text-red-600 dark:text-red-400">{n.urgent}</span>}
              {n.urgent && n.detail && " · "}
              {n.detail}
            </p>
          </Link>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[11px] whitespace-nowrap text-muted-foreground">{n.time}</span>
            {n.action ? (
              <button
                type="button"
                onClick={onAction}
                disabled={leaving}
                className={cn(
                  "flex items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs whitespace-nowrap transition-colors hover:bg-accent",
                  n.action.type !== "move-today" &&
                    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
                )}
              >
                {n.action.type === "move-today" ? <CalendarArrowUpIcon className="size-3" /> : <CheckIcon className="size-3" />}
                {ACTION_LABEL[n.action.type]}
              </button>
            ) : (
              <Link
                href={n.href}
                onClick={onOpen}
                className="rounded-md border bg-card px-2 py-0.5 text-xs whitespace-nowrap transition-colors hover:bg-accent"
              >
                Abrir
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
