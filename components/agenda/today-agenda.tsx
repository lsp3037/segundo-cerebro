import Link from "next/link";

import { minutesToTime, wallParts } from "@/lib/dates";
import type { Occurrence } from "@/lib/events-expand";
import type { Area } from "@/lib/modules";

// Compromissos do dia, na lateral da aba Hoje.
export function TodayAgenda({ occurrences, areas, connected }: { occurrences: Occurrence[]; areas: Area[]; connected: boolean }) {
  const color = (o: Occurrence) => areas.find((a) => a.id === o.areaId)?.color ?? "#737373";

  return (
    <section className="rounded-xl border">
      <header className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 className="text-sm font-semibold">Agenda de hoje</h2>
        <Link href="/agenda?v=dia" className="text-xs text-muted-foreground hover:text-foreground">
          Abrir
        </Link>
      </header>
      {!connected ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          <Link href="/configuracoes#agenda" className="underline underline-offset-4">
            Conecte o Google Agenda
          </Link>{" "}
          para ver seus compromissos aqui.
        </p>
      ) : occurrences.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum compromisso hoje.</p>
      ) : (
        <ul className="space-y-0.5 p-1.5">
          {occurrences.map((o) => (
            <li key={o.key} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm">
              <span className="h-4 w-1 shrink-0 rounded-full" style={{ backgroundColor: color(o) }} />
              <span className="w-11 shrink-0 text-xs text-muted-foreground tabular-nums">
                {o.allDay ? "dia" : minutesToTime(wallParts(o.start).minutes)}
              </span>
              <span className="min-w-0 flex-1 truncate">{o.title}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
