"use client";

import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useOpenParam } from "@/components/use-open-param";
import { useOptimisticList } from "@/components/use-optimistic-list";
import { createPublication, type PublicationInput, trashContent, updatePublication } from "@/lib/actions/content";
import {
  addDays,
  addMonths,
  eachDay,
  endOfMonth,
  formatMonthYear,
  formatRelativeDay,
  formatWeekdayShort,
  fromWallParts,
  type IsoDate,
  minutesToTime,
  startOfMonth,
  startOfWeek,
  wallParts,
} from "@/lib/dates";
import type { Tables } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";
import { CHANNELS, type Channel, labelOf, PUBLICATION_STATUS, type PublicationStatus } from "./meta";

type Publication = Tables<"publications">;
type Idea = Pick<Tables<"content_ideas">, "id" | "title" | "format">;

const NONE = "__none__";
const DEFAULT_MINUTES = 18 * 60;
// Limite de legenda do Instagram.
const CAPTION_LIMIT = 2200;

const STATUS_STYLE: Record<PublicationStatus, string> = {
  idea: "border-dashed text-muted-foreground",
  script: "border-amber-500/40 bg-amber-500/10",
  production: "border-sky-500/40 bg-sky-500/10",
  scheduled: "border-violet-500/40 bg-violet-500/10",
  published: "border-emerald-500/40 bg-emerald-500/10",
};

const CHANNEL_SHORT: Record<Channel, string> = { instagram: "IG", google_business: "GMN" };

type View = "calendario" | "funil";

export function PublicationsBoard({
  initialPublications,
  ideas,
  today,
}: {
  initialPublications: Publication[];
  ideas: Idea[];
  today: IsoDate;
}) {
  const list = useOptimisticList(initialPublications);
  const [view, setView] = useState<View>("calendario");
  const [month, setMonth] = useState(startOfMonth(today));
  const [openId, setOpenId] = useOpenParam("publicacao");
  const open = list.items.find((p) => p.id === openId) ?? null;
  const ideaById = new Map(ideas.map((i) => [i.id, i]));

  const titleOf = (p: Publication) =>
    (p.content_idea_id && ideaById.get(p.content_idea_id)?.title) || p.caption?.split("\n")[0] || "Sem título";

  async function create(date: IsoDate | null) {
    const result = await createPublication({
      channel: "instagram",
      status: "idea",
      scheduled_for: date ? fromWallParts(date, DEFAULT_MINUTES) : null,
    });
    if (!result.ok) return toast.error(result.error);
    list.setItems((items) => [...items, result.data]);
    setOpenId(result.data.id);
  }

  return (
    <div className="space-y-4 px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border p-0.5" role="radiogroup" aria-label="Visão">
          {(
            [
              ["calendario", "Calendário"],
              ["funil", "Funil"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={view === value}
              onClick={() => setView(value)}
              className={cn("h-7 rounded px-2.5 text-xs", view === value ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "calendario" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
              <ChevronLeftIcon />
            </Button>
            <span className="min-w-36 text-center text-sm font-medium capitalize">{formatMonthYear(month)}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
              <ChevronRightIcon />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMonth(startOfMonth(today))}>
              Hoje
            </Button>
          </div>
        )}

        <Button size="sm" className="ml-auto" onClick={() => create(null)}>
          <PlusIcon />
          Nova publicação
        </Button>
      </div>

      {view === "calendario" ? (
        <CalendarView
          month={month}
          today={today}
          publications={list.items}
          titleOf={titleOf}
          onOpen={setOpenId}
          onCreate={create}
        />
      ) : (
        <FunnelView publications={list.items} titleOf={titleOf} today={today} onOpen={setOpenId} />
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-md">
          {open && (
            <PublicationForm
              key={open.id}
              publication={open}
              ideas={ideas}
              onUpdate={(patch) => list.patch(open.id, patch as Partial<Publication>, () => updatePublication(open.id, patch))}
              onTrash={() => {
                setOpenId(null);
                list.removeItem(open.id, () => trashContent("publications", open.id));
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function PublicationChip({ p, title, onOpen, showTime }: { p: Publication; title: string; onOpen: () => void; showTime?: boolean }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={cn("flex w-full items-center gap-1 truncate rounded border px-1.5 py-0.5 text-left text-xs", STATUS_STYLE[p.status as PublicationStatus])}
      title={`${labelOf(CHANNELS, p.channel)} · ${labelOf(PUBLICATION_STATUS, p.status)}`}
    >
      <span className="shrink-0 font-semibold">{CHANNEL_SHORT[p.channel as Channel]}</span>
      {showTime && p.scheduled_for && <span className="shrink-0 tabular-nums">{minutesToTime(wallParts(p.scheduled_for).minutes)}</span>}
      <span className="truncate">{title}</span>
    </button>
  );
}

function CalendarView({
  month,
  today,
  publications,
  titleOf,
  onOpen,
  onCreate,
}: {
  month: IsoDate;
  today: IsoDate;
  publications: Publication[];
  titleOf: (p: Publication) => string;
  onOpen: (id: string) => void;
  onCreate: (date: IsoDate) => void;
}) {
  const days = eachDay(startOfWeek(month), addDays(startOfWeek(endOfMonth(month)), 6));
  const byDay = new Map<string, Publication[]>();
  const unscheduled: Publication[] = [];
  for (const p of publications) {
    if (!p.scheduled_for) {
      unscheduled.push(p);
      continue;
    }
    const day = wallParts(p.scheduled_for).date;
    byDay.set(day, [...(byDay.get(day) ?? []), p]);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_16rem]">
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground uppercase">
          {days.slice(0, 7).map((d) => (
            <div key={d} className="py-1.5">
              {formatWeekdayShort(d)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const items = (byDay.get(day) ?? []).sort((a, b) => a.scheduled_for!.localeCompare(b.scheduled_for!));
            const inMonth = day.slice(0, 7) === month.slice(0, 7);
            return (
              <div
                key={day}
                onClick={() => onCreate(day)}
                title="Clique para planejar uma publicação neste dia"
                className={cn("min-h-24 cursor-cell border-r border-b p-1 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}
              >
                <div
                  className={cn(
                    "mb-0.5 flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                    day === today ? "bg-foreground font-semibold text-background" : !inMonth && "text-muted-foreground",
                  )}
                >
                  {Number(day.slice(8))}
                </div>
                <ul className="space-y-0.5">
                  {items.map((p) => (
                    <li key={p.id}>
                      <PublicationChip p={p} title={titleOf(p)} onOpen={() => onOpen(p.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <section className="rounded-lg border bg-muted/30">
        <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sem data <span className="font-normal tabular-nums">{unscheduled.length}</span>
        </h2>
        <ul className="space-y-1 p-1.5 pt-0">
          {unscheduled.map((p) => (
            <li key={p.id}>
              <PublicationChip p={p} title={titleOf(p)} onOpen={() => onOpen(p.id)} />
            </li>
          ))}
          {unscheduled.length === 0 && <li className="px-1.5 pb-1.5 text-xs text-muted-foreground">Tudo com data marcada.</li>}
        </ul>
      </section>
    </div>
  );
}

function FunnelView({
  publications,
  titleOf,
  today,
  onOpen,
}: {
  publications: Publication[];
  titleOf: (p: Publication) => string;
  today: IsoDate;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
      {PUBLICATION_STATUS.map((s) => {
        const items = publications.filter((p) => p.status === s.value);
        return (
          <section key={s.value} className="flex flex-col rounded-lg border bg-muted/30">
            <h2 className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {s.label} <span className="font-normal tabular-nums">{items.length}</span>
            </h2>
            <ul className="flex-1 space-y-1.5 p-1.5 pt-0">
              {items.map((p) => {
                const when = p.scheduled_for ? wallParts(p.scheduled_for) : null;
                const late = when && when.date < today && p.status !== "published";
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className="flex w-full flex-col gap-1 rounded-md border bg-background p-2.5 text-left hover:border-foreground/25"
                    >
                      <span className="text-sm">{titleOf(p)}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{labelOf(CHANNELS, p.channel)}</span>
                        {when && (
                          <span className={cn("ml-auto", late && "font-medium text-destructive")}>
                            {formatRelativeDay(when.date, today)} {minutesToTime(when.minutes)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function PublicationForm({
  publication,
  ideas,
  onUpdate,
  onTrash,
}: {
  publication: Publication;
  ideas: Idea[];
  onUpdate: (patch: PublicationInput) => Promise<boolean>;
  onTrash: () => void;
}) {
  const when = publication.scheduled_for ? wallParts(publication.scheduled_for) : null;
  const [date, setDate] = useState(when?.date ?? "");
  const [time, setTime] = useState(when ? minutesToTime(when.minutes) : "18:00");
  const [caption, setCaption] = useState(publication.caption ?? "");
  const [notes, setNotes] = useState(publication.notes ?? "");
  const [url, setUrl] = useState(publication.published_url ?? "");

  function saveWhen(nextDate: string, nextTime: string) {
    if (!nextDate) return onUpdate({ scheduled_for: null });
    const [h, m] = (nextTime || "18:00").split(":").map(Number);
    onUpdate({ scheduled_for: fromWallParts(nextDate, h * 60 + m) });
  }

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle>Publicação</SheetTitle>
        <SheetDescription>Tudo é salvo automaticamente.</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Status">
          {PUBLICATION_STATUS.map((s) => (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={publication.status === s.value}
              onClick={() => onUpdate({ status: s.value })}
              className={cn(
                "h-7 rounded-md border px-2.5 text-xs",
                publication.status === s.value ? "border-foreground/40 bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Canal">
            <Select value={publication.channel} onValueChange={(v) => onUpdate({ channel: v as Channel })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Ideia de conteúdo">
            <Select
              value={publication.content_idea_id ?? NONE}
              onValueChange={(v) => onUpdate({ content_idea_id: v === NONE ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhuma</SelectItem>
                {ideas.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Data" htmlFor="pub-date">
            <Input
              id="pub-date"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                saveWhen(e.target.value, time);
              }}
            />
          </Field>
          <Field label="Hora" htmlFor="pub-time">
            <Input
              id="pub-time"
              type="time"
              value={time}
              disabled={!date}
              onChange={(e) => setTime(e.target.value)}
              onBlur={() => date && saveWhen(date, time)}
            />
          </Field>
        </div>

        <Field
          label="Legenda"
          htmlFor="pub-caption"
          hint={publication.channel === "instagram" ? `${caption.length} / ${CAPTION_LIMIT} caracteres` : `${caption.length} caracteres`}
        >
          <Textarea
            id="pub-caption"
            rows={8}
            value={caption}
            maxLength={5000}
            onChange={(e) => setCaption(e.target.value)}
            onBlur={() => caption !== (publication.caption ?? "") && onUpdate({ caption: caption || null })}
            placeholder="Texto que vai no post…"
            className={cn(publication.channel === "instagram" && caption.length > CAPTION_LIMIT && "border-destructive")}
          />
        </Field>

        <Field label="Anotações" htmlFor="pub-notes">
          <Textarea
            id="pub-notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (publication.notes ?? "") && onUpdate({ notes: notes || null })}
            placeholder="Roteiro, cenas, o que falta produzir…"
          />
        </Field>

        <Field label="Link do post publicado" htmlFor="pub-url">
          <div className="flex gap-2">
            <Input
              id="pub-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => {
                const v = url.trim();
                if (v === (publication.published_url ?? "")) return;
                onUpdate({ published_url: v ? (/^https?:\/\//i.test(v) ? v : `https://${v}`) : null });
              }}
              placeholder="https://instagram.com/p/…"
            />
            {publication.published_url && (
              <Button variant="outline" size="icon" asChild>
                <a href={publication.published_url} target="_blank" rel="noreferrer" aria-label="Abrir post">
                  <ExternalLinkIcon />
                </a>
              </Button>
            )}
          </div>
        </Field>
      </div>

      <SheetFooter className="flex-row justify-end border-t">
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onTrash}>
          <Trash2Icon />
          Excluir
        </Button>
      </SheetFooter>
    </>
  );
}
