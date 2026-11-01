"use client";

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";

import { addDays } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { compareTasks, STATUSES, type Task, type TaskStatus } from "./meta";
import { TaskQuickAdd } from "./task-quick-add";
import { TaskRow } from "./task-row";
import type { ViewProps } from "./tasks-board";

const COLUMNS: TaskStatus[] = ["todo", "doing", "waiting", "done"];

// Quadro por status. Arrastar um cartão para outra coluna muda o status.
export function TasksKanban({ list, today, defaultAreaId, folderId, onOpen, onToggle }: ViewProps) {
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const columns = useMemo(() => {
    const recent = addDays(today, -14);
    return COLUMNS.map((status) => ({
      status,
      label: STATUSES.find((s) => s.value === status)!.label,
      tasks: list.tasks
        .filter((t) => t.status === status && (status !== "done" || (t.completed_at ?? "") >= recent))
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || compareTasks(a, b)),
    }));
  }, [list.tasks, today]);

  function onDragStart({ active }: DragStartEvent) {
    setDragging(list.tasks.find((t) => t.id === active.id) ?? null);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    const task = list.tasks.find((t) => t.id === active.id);
    const status = over?.id as TaskStatus | undefined;
    if (task && status && task.status !== status) list.setStatus(task, status);
  }

  return (
    <div className="space-y-4">
      <TaskQuickAdd list={list} today={today} defaultAreaId={defaultAreaId} folderId={folderId} />
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((col) => (
            <Column key={col.status} status={col.status} label={col.label} count={col.tasks.length}>
              {col.tasks.map((t) => (
                <Card key={t.id} task={t}>
                  <TaskRow task={t} today={today} onOpen={() => onOpen(t)} onToggle={() => onToggle(t)} />
                </Card>
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay>
          {dragging && (
            <div className="rounded-md border bg-background shadow-lg">
              <TaskRow task={dragging} today={today} onOpen={() => {}} onToggle={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  label,
  count,
  children,
}: {
  status: TaskStatus;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className={cn("flex min-h-48 flex-col rounded-lg border bg-muted/30 transition-colors", isOver && "border-foreground/40 bg-accent/50")}
    >
      <h3 className="flex items-center gap-2 px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        <span className="font-normal tabular-nums">{count}</span>
      </h3>
      <div className="flex-1 space-y-1.5 p-1.5 pt-0">{children}</div>
    </section>
  );
}

function Card({ task, children }: { task: Task; children: React.ReactNode }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("rounded-md border bg-background touch-none", isDragging && "opacity-40")}
    >
      {children}
    </div>
  );
}
