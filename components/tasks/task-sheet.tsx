"use client";

import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { LgpdNotice } from "@/components/lgpd-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace";
import { formatDateTime } from "@/lib/dates";
import { RECURRENCE_OPTIONS } from "@/lib/recurrence";
import { PRIORITIES, STATUSES, type Task, type TaskStatus } from "./meta";
import { TaskCheckbox } from "./task-row";
import type { TaskList } from "./use-task-list";

const NONE = "__none__";

// Painel lateral de edição. Cada campo salva sozinho ao mudar (ou ao sair do campo, nos textos).
export function TaskSheet({ task, list, onClose }: { task: Task | null; list: TaskList; onClose: () => void }) {
  return (
    <Sheet open={task !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        {task && <TaskForm key={task.id} task={task} list={list} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskForm({ task, list, onClose }: { task: Task; list: TaskList; onClose: () => void }) {
  const { areas, areaById, foldersFor } = useWorkspace();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const area = areaById.get(task.area_id);
  const folders = foldersFor("tasks", task.area_id);

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <SheetTitle className="sr-only">Editar tarefa</SheetTitle>
        <SheetDescription className="sr-only">Altere os campos; tudo é salvo automaticamente.</SheetDescription>
        <div className="flex items-start gap-3">
          <TaskCheckbox
            task={task}
            className="mt-1.5"
            onToggle={() => list.setStatus(task, task.status === "done" ? "todo" : "done")}
          />
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              const text = title.trim();
              if (!text) setTitle(task.title);
              else if (text !== task.title) list.update(task.id, { title: text });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            aria-label="Título"
            rows={1}
            maxLength={300}
            className="min-h-0 resize-none border-none p-0 text-base font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </SheetHeader>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {area?.show_lgpd_notice && <LgpdNotice />}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Área">
            <Select
              value={task.area_id}
              onValueChange={(area_id) => list.update(task.id, { area_id, folder_id: null })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Pasta">
            <Select
              value={task.folder_id ?? NONE}
              onValueChange={(v) => list.update(task.id, { folder_id: v === NONE ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem pasta</SelectItem>
                {folders.map(({ folder, label }) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Status">
            <Select value={task.status} onValueChange={(v) => list.setStatus(task, v as TaskStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Prioridade">
            <Select value={String(task.priority)} onValueChange={(v) => list.update(task.id, { priority: Number(v) })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={String(p.value)}>
                    <span className={p.className}>●</span>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Data" htmlFor="task-date">
            <Input
              id="task-date"
              type="date"
              value={task.due_date ?? ""}
              onChange={(e) => list.update(task.id, { due_date: e.target.value || null })}
            />
          </Field>

          <Field label="Horário" htmlFor="task-time" hint={!task.due_date ? "Defina a data antes." : undefined}>
            <Input
              id="task-time"
              type="time"
              disabled={!task.due_date}
              value={task.start_time?.slice(0, 5) ?? ""}
              onChange={(e) => list.update(task.id, { start_time: e.target.value || null })}
            />
          </Field>

          <Field label="Duração (min)" htmlFor="task-duration">
            <Input
              id="task-duration"
              type="number"
              min={5}
              step={5}
              placeholder="—"
              defaultValue={task.duration_min ?? ""}
              onBlur={(e) => {
                const value = e.target.value ? Number(e.target.value) : null;
                if (value !== task.duration_min) list.update(task.id, { duration_min: value });
              }}
            />
          </Field>

          <Field label="Repetir" hint={task.recurrence_rule && !task.due_date ? "Precisa de uma data." : undefined}>
            <Select
              value={task.recurrence_rule ?? NONE}
              onValueChange={(v) => list.update(task.id, { recurrence_rule: v === NONE ? null : v })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECURRENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value || NONE} value={o.value || NONE}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Notas" htmlFor="task-notes">
          <Textarea
            id="task-notes"
            value={notes}
            rows={6}
            placeholder="Detalhes, links, próximos passos…"
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (task.notes ?? "")) list.update(task.id, { notes: notes || null });
            }}
          />
        </Field>
      </div>

      <SheetFooter className="flex-row items-center justify-between border-t">
        <span className="text-xs text-muted-foreground">Criada em {formatDateTime(task.created_at)}</span>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => {
            onClose();
            list.remove(task);
          }}
        >
          <Trash2Icon />
          Excluir
        </Button>
      </SheetFooter>
    </>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
