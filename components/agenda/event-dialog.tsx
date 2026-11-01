"use client";

import { ExternalLinkIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Field } from "@/components/form-bits";
import { LgpdNotice } from "@/components/lgpd-notice";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace";
import { createEvent, type EventInput, getEventForEdit, removeEvent, updateEvent } from "@/lib/actions/events";
import { addDays, fromWallParts, type IsoDate, minutesToTime, wallParts } from "@/lib/dates";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import type { Tables } from "@/lib/supabase/database.types";

const NONE = "__none__";
const CUSTOM = "__custom__";

export type CalendarOption = {
  id: string;
  name: string;
  default_area_id: string | null;
  writable: boolean;
  is_primary: boolean;
  sync_enabled: boolean;
};

export type DialogState = { mode: "create"; date: IsoDate; minutes: number | null } | { mode: "edit"; eventId: string } | null;

type Form = {
  title: string;
  calendarId: string;
  areaId: string | null;
  allDay: boolean;
  startDate: IsoDate;
  startTime: string;
  endDate: IsoDate;
  endTime: string;
  repeat: string;
  location: string;
  description: string;
};

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function EventDialog({
  state,
  calendars,
  defaultAreaId,
  onClose,
  onSaved,
}: {
  state: DialogState;
  calendars: CalendarOption[];
  defaultAreaId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && onClose()}>
      {state && (
        <EventForm
          key={state.mode === "edit" ? state.eventId : `${state.date}-${state.minutes}`}
          state={state}
          calendars={calendars}
          defaultAreaId={defaultAreaId}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function emptyForm(state: { date: IsoDate; minutes: number | null }, calendars: CalendarOption[], defaultAreaId: string | null): Form {
  const writable = calendars.filter((c) => c.writable && c.sync_enabled);
  const cal = writable.find((c) => c.is_primary && c.default_area_id === defaultAreaId) ?? writable.find((c) => c.is_primary) ?? writable[0];
  const start = state.minutes ?? 9 * 60;
  return {
    title: "",
    calendarId: cal?.id ?? "",
    areaId: defaultAreaId ?? cal?.default_area_id ?? null,
    allDay: state.minutes === null,
    startDate: state.date,
    startTime: minutesToTime(start),
    endDate: state.date,
    endTime: minutesToTime(Math.min(start + 60, 23 * 60 + 59)),
    repeat: "",
    location: "",
    description: "",
  };
}

function formFromEvent(e: Tables<"events">): Form {
  const s = wallParts(e.start_at);
  const end = wallParts(e.all_day ? new Date(new Date(e.end_at).getTime() - 1).toISOString() : e.end_at);
  const rule = e.recurrence?.find((l) => l.startsWith("RRULE:"))?.slice(6) ?? "";
  return {
    title: e.title,
    calendarId: e.calendar_id ?? "",
    areaId: e.area_id,
    allDay: e.all_day,
    startDate: s.date,
    startTime: minutesToTime(s.minutes),
    endDate: end.date,
    endTime: minutesToTime(end.minutes),
    repeat: !rule ? "" : RECURRENCE_OPTIONS.some((o) => o.value === rule) ? rule : CUSTOM,
    location: e.location ?? "",
    description: e.description ?? "",
  };
}

function EventForm({
  state,
  calendars,
  defaultAreaId,
  onClose,
  onSaved,
}: {
  state: NonNullable<DialogState>;
  calendars: CalendarOption[];
  defaultAreaId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { areas, areaById } = useWorkspace();
  const [event, setEvent] = useState<Tables<"events"> | null>(null);
  const [form, setForm] = useState<Form | null>(state.mode === "create" ? emptyForm(state, calendars, defaultAreaId) : null);
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Carrega o evento só uma vez por abertura (não recarrega se a tela de trás atualizar).
  const editId = state.mode === "edit" ? state.eventId : null;
  useEffect(() => {
    if (!editId) return;
    let alive = true;
    getEventForEdit(editId).then((result) => {
      if (!alive) return;
      if (!result.ok) {
        toast.error(result.error);
        closeRef.current();
        return;
      }
      setEvent(result.data);
      setForm(formFromEvent(result.data));
    });
    return () => {
      alive = false;
    };
  }, [editId]);

  if (!form) {
    return (
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Carregando…</DialogTitle>
          <DialogDescription className="sr-only">Buscando o evento</DialogDescription>
        </DialogHeader>
        <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground" />
      </DialogContent>
    );
  }

  const set = (patch: Partial<Form>) => setForm({ ...form, ...patch });
  const calendar = calendars.find((c) => c.id === form.calendarId);
  const readOnly = Boolean(event && calendar && !calendar.writable);
  const isRecurring = Boolean(event?.recurrence?.length);
  const area = form.areaId ? areaById.get(form.areaId) : undefined;

  function toInput(): EventInput | null {
    if (!form) return null;
    const startAt = form.allDay ? fromWallParts(form.startDate, 0) : fromWallParts(form.startDate, toMinutes(form.startTime));
    const endAt = form.allDay ? fromWallParts(addDays(form.endDate, 1), 0) : fromWallParts(form.endDate, toMinutes(form.endTime));
    return {
      calendar_id: form.calendarId,
      area_id: form.areaId,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      start_at: startAt,
      end_at: endAt,
      all_day: form.allDay,
      recurrence_rule: form.repeat && form.repeat !== CUSTOM ? form.repeat : null,
    };
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const input = toInput();
    if (!input) return;
    if (!input.calendar_id) {
      toast.error("Escolha a agenda.");
      return;
    }
    startTransition(async () => {
      let result;
      if (event) {
        // Regra personalizada (feita no Google) é mantida como está.
        const { recurrence_rule, ...rest } = input;
        result = await updateEvent(event.id, form!.repeat === CUSTOM ? rest : { ...rest, recurrence_rule });
      } else {
        result = await createEvent(input);
      }
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(event ? "Evento salvo no Google Agenda." : "Evento criado no Google Agenda.");
      onSaved();
    });
  }

  function remove() {
    if (!event) return;
    startTransition(async () => {
      const result = await removeEvent(event.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Evento apagado.");
      onSaved();
    });
  }

  return (
    <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
      <form onSubmit={save} className="contents">
        <DialogHeader>
          <DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle>
          <DialogDescription>
            {readOnly
              ? "Esta agenda é só de leitura no Google."
              : isRecurring
                ? "Este evento se repete: as alterações valem para todas as repetições."
                : "Salvo direto no Google Agenda."}
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={readOnly || pending} className="space-y-4">
          <Input
            autoFocus
            required
            maxLength={500}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Título"
            aria-label="Título"
            className="text-base font-medium"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Agenda">
              <Select
                value={form.calendarId || NONE}
                disabled={Boolean(event)}
                onValueChange={(v) => {
                  const cal = calendars.find((c) => c.id === v);
                  set({ calendarId: v, areaId: form.areaId ?? cal?.default_area_id ?? null });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha" />
                </SelectTrigger>
                <SelectContent>
                  {calendars
                    .filter((c) => c.sync_enabled && (c.writable || c.id === form.calendarId))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Área">
              <Select value={form.areaId ?? NONE} onValueChange={(v) => set({ areaId: v === NONE ? null : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sem área</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <label className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
            Dia inteiro
            <Switch checked={form.allDay} onCheckedChange={(allDay) => set({ allDay })} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Começa">
              <div className="flex gap-1.5">
                <Input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => set({ startDate: e.target.value, endDate: e.target.value > form.endDate ? e.target.value : form.endDate })}
                />
                {!form.allDay && <Input type="time" required value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} className="w-28" />}
              </div>
            </Field>
            <Field label="Termina">
              <div className="flex gap-1.5">
                <Input type="date" required min={form.startDate} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
                {!form.allDay && <Input type="time" required value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} className="w-28" />}
              </div>
            </Field>
          </div>

          <Field label="Repetir">
            <Select value={form.repeat || NONE} onValueChange={(v) => set({ repeat: v === NONE ? "" : v })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value || NONE} value={o.value || NONE}>
                    {o.label}
                  </SelectItem>
                ))}
                {form.repeat === CUSTOM && <SelectItem value={CUSTOM}>Personalizada (definida no Google)</SelectItem>}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Local" htmlFor="event-location">
            <Input id="event-location" maxLength={500} value={form.location} onChange={(e) => set({ location: e.target.value })} />
          </Field>

          <Field label="Descrição" htmlFor="event-description">
            <Textarea id="event-description" rows={3} maxLength={8000} value={form.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>

          {area?.show_lgpd_notice && <LgpdNotice />}
        </fieldset>

        <DialogFooter className="items-center sm:justify-between">
          <div className="flex items-center gap-1">
            {event && !readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
                disabled={pending}
              >
                <Trash2Icon />
                {confirmDelete ? (isRecurring ? "Apagar todas as repetições?" : "Confirmar") : "Apagar"}
              </Button>
            )}
            {event?.html_link && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <a href={event.html_link} target="_blank" rel="noreferrer">
                  <ExternalLinkIcon />
                  Google
                </a>
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={pending || !form.title.trim()}>
                {pending && <Loader2Icon className="animate-spin" />}
                Salvar
              </Button>
            )}
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
