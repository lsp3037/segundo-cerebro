"use client";

import { ChevronLeftIcon, ChevronRightIcon, FlameIcon, Loader2Icon, MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createHabit, type HabitInput, trashHabit, updateHabit } from "@/lib/actions/habits";
import {
  addDays,
  addMonths,
  eachDay,
  endOfMonth,
  formatMonthYear,
  formatWeekdayShort,
  type IsoDate,
  startOfMonth,
} from "@/lib/dates";
import {
  currentStreak,
  describeFrequency,
  type Habit,
  type HabitLog,
  isScheduled,
  WEEKDAY_LABELS,
  WEEKDAY_NAMES,
} from "@/lib/habits";
import { AREA_COLOR_PRESETS } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { useHabitLogs } from "./use-habits";

// Tela da pasta "Rotina": cadastro de hábitos, últimos dias e mapa do mês.
export function HabitsManager({
  habits,
  logs,
  today,
  areaId,
  folderId,
}: {
  habits: Habit[];
  logs: HabitLog[];
  today: IsoDate;
  areaId: string;
  folderId: string;
}) {
  const { daysOf, toggle } = useHabitLogs(logs);
  const [editing, setEditing] = useState<Habit | "new" | null>(null);
  const [month, setMonth] = useState(() => startOfMonth(today));
  const lastDays = eachDay(addDays(today, -6), today);
  const monthDays = eachDay(month, endOfMonth(month));

  return (
    <div className="space-y-8 px-4 py-5 md:px-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Hábitos</h2>
          <Button size="sm" onClick={() => setEditing("new")}>
            <PlusIcon />
            Novo hábito
          </Button>
        </div>

        {habits.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-10 text-center">
            <p className="text-sm font-medium">Nenhum hábito ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Ex.: ler 20 minutos, academia, estudar para o mestrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Hábito</th>
                  {lastDays.map((d) => (
                    <th key={d} className={cn("w-9 py-2 text-center font-medium", d === today && "text-foreground")}>
                      <div className="uppercase">{formatWeekdayShort(d).slice(0, 3)}</div>
                      <div className="tabular-nums">{Number(d.slice(8))}</div>
                    </th>
                  ))}
                  <th className="w-24 px-3 py-2 text-right font-medium">Sequência</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {habits.map((habit) => {
                  const days = daysOf(habit.id);
                  const streak = currentStreak(habit, days, today);
                  return (
                    <tr key={habit.id} className={cn("border-b last:border-0", !habit.active && "opacity-50")}>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: habit.color ?? "currentColor" }} />
                          <span className="font-medium">{habit.name}</span>
                        </div>
                        <div className="pl-4 text-xs text-muted-foreground">
                          {describeFrequency(habit)}
                          {!habit.active && " · pausado"}
                        </div>
                      </td>
                      {lastDays.map((d) => (
                        <td key={d} className="text-center">
                          <DayCell habit={habit} day={d} done={days.has(d)} onToggle={() => toggle(habit, d)} />
                        </td>
                      ))}
                      <td className="px-3 text-right text-xs text-muted-foreground tabular-nums">
                        {streak.value > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <FlameIcon className="size-3 text-orange-500" />
                            {streak.value} {streak.unit}
                          </span>
                        )}
                      </td>
                      <td className="pr-2">
                        <HabitMenu habit={habit} onEdit={() => setEditing(habit)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {habits.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="mr-2 text-sm font-semibold">Mapa do mês</h2>
            <Button variant="outline" size="icon-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
              <ChevronLeftIcon />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês">
              <ChevronRightIcon />
            </Button>
            <span className="text-sm first-letter:uppercase">{formatMonthYear(month)}</span>
          </div>
          <div className="space-y-2 overflow-x-auto rounded-xl border p-3">
            {habits.map((habit) => {
              const days = daysOf(habit.id);
              const scheduled = monthDays.filter((d) => d <= today && isScheduled(habit, d));
              const hits = scheduled.filter((d) => days.has(d)).length;
              return (
                <div key={habit.id} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-xs">{habit.name}</span>
                  <div className="flex gap-0.5">
                    {monthDays.map((d) => (
                      <span
                        key={d}
                        title={`${Number(d.slice(8))}/${d.slice(5, 7)}${days.has(d) ? " · feito" : ""}`}
                        className={cn(
                          "size-3.5 rounded-[3px]",
                          days.has(d)
                            ? "bg-(--habit)"
                            : d > today || !isScheduled(habit, d)
                              ? "bg-muted/50"
                              : "bg-muted ring-1 ring-border ring-inset",
                        )}
                        style={{ "--habit": habit.color ?? "var(--foreground)" } as React.CSSProperties}
                      />
                    ))}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {scheduled.length > 0 ? `${Math.round((hits / scheduled.length) * 100)}%` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <HabitDialog
        habit={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        areaId={areaId}
        folderId={folderId}
      />
    </div>
  );
}

function DayCell({ habit, day, done, onToggle }: { habit: Habit; day: IsoDate; done: boolean; onToggle: () => void }) {
  const scheduled = isScheduled(habit, day);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={`${habit.name}, ${WEEKDAY_NAMES[new Date(`${day}T00:00:00Z`).getUTCDay()]} ${Number(day.slice(8))}`}
      onClick={onToggle}
      className={cn(
        "mx-auto flex size-6 items-center justify-center rounded-md border transition-colors",
        done ? "border-transparent bg-(--habit)" : scheduled ? "hover:bg-accent" : "border-dashed opacity-50 hover:opacity-100",
      )}
      style={{ "--habit": habit.color ?? "var(--foreground)" } as React.CSSProperties}
    />
  );
}

function HabitMenu({ habit, onEdit }: { habit: Habit; onEdit: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Opções de ${habit.name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <PencilIcon />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onSelect={async () => {
            const result = await trashHabit(habit.id);
            if (result.ok) toast.success("Hábito excluído.");
            else toast.error(result.error);
          }}
        >
          <Trash2Icon />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HabitDialog({
  habit,
  open,
  onClose,
  areaId,
  folderId,
}: {
  habit: Habit | null;
  open: boolean;
  onClose: () => void;
  areaId: string;
  folderId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {open && <HabitForm key={habit?.id ?? "new"} habit={habit} onClose={onClose} areaId={areaId} folderId={folderId} />}
    </Dialog>
  );
}

function HabitForm({
  habit,
  onClose,
  areaId,
  folderId,
}: {
  habit: Habit | null;
  onClose: () => void;
  areaId: string;
  folderId: string;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [frequency, setFrequency] = useState<NonNullable<HabitInput["frequency"]>>(
    (habit?.frequency as HabitInput["frequency"]) ?? "daily",
  );
  const [weekdays, setWeekdays] = useState<number[]>(habit?.weekdays ?? [1, 2, 3, 4, 5]);
  const [timesPerWeek, setTimesPerWeek] = useState(habit?.times_per_week ?? 3);
  const [color, setColor] = useState(habit?.color ?? AREA_COLOR_PRESETS[3]);
  const [active, setActive] = useState(habit?.active ?? true);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const data: HabitInput = {
      name,
      frequency,
      weekdays: frequency === "weekdays" ? weekdays : [],
      times_per_week: frequency === "times_per_week" ? timesPerWeek : null,
      color,
      active,
    };
    startTransition(async () => {
      const result = habit
        ? await updateHabit(habit.id, data)
        : await createHabit({ ...data, area_id: areaId, folder_id: folderId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="contents">
        <DialogHeader>
          <DialogTitle>{habit ? "Editar hábito" : "Novo hábito"}</DialogTitle>
          <DialogDescription>Marque a cada dia na aba Hoje.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Nome</Label>
            <Input id="habit-name" autoFocus required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Ler 20 minutos" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="habit-frequency">Frequência</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
              <SelectTrigger id="habit-frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Todo dia</SelectItem>
                <SelectItem value="weekdays">Em dias da semana específicos</SelectItem>
                <SelectItem value="times_per_week">Algumas vezes por semana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === "weekdays" && (
            <div className="flex gap-1.5" role="group" aria-label="Dias da semana">
              {WEEKDAY_LABELS.map((label, day) => {
                const selected = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    aria-label={WEEKDAY_NAMES[day]}
                    onClick={() => setWeekdays(selected ? weekdays.filter((d) => d !== day) : [...weekdays, day])}
                    className={cn(
                      "size-8 rounded-full border text-xs font-medium",
                      selected ? "border-transparent bg-foreground text-background" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {frequency === "times_per_week" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={7}
                value={timesPerWeek}
                onChange={(e) => setTimesPerWeek(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
                className="w-20"
                aria-label="Vezes por semana"
              />
              <span className="text-sm text-muted-foreground">vezes por semana</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-1.5">
              {AREA_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Cor ${preset}`}
                  aria-pressed={preset === color}
                  onClick={() => setColor(preset)}
                  className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", preset === color && "ring-2 ring-foreground/60")}
                  style={{ backgroundColor: preset }}
                />
              ))}
            </div>
          </div>

          {habit && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2.5">
              <div>
                <Label htmlFor="habit-active">Ativo</Label>
                <p className="text-xs text-muted-foreground">Pausado, ele some da aba Hoje mas guarda o histórico.</p>
              </div>
              <Switch id="habit-active" checked={active} onCheckedChange={setActive} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending && <Loader2Icon className="animate-spin" />}
            {habit ? "Salvar" : "Criar hábito"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
