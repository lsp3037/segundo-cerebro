"use client";

import { CalendarArrowUpIcon, CheckIcon, ClockIcon, RepeatIcon } from "lucide-react";

import { useWorkspace } from "@/components/workspace";
import { formatOverdue, formatRelativeDay, formatTime, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { isOpen, priorityOf, type Task } from "./meta";

export function TaskCheckbox({
  task,
  onToggle,
  className,
}: {
  task: Task;
  onToggle: () => void;
  className?: string;
}) {
  const done = task.status === "done";
  const priority = priorityOf(task.priority);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Reabrir "${task.title}"` : `Concluir "${task.title}"`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={cn(
        "group/check flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
        done ? "border-transparent bg-foreground/30 text-background" : priority.ring,
        !done && task.priority <= 2 && "bg-current/5",
        className,
      )}
    >
      <CheckIcon
        className={cn("size-3 stroke-3", done ? "opacity-100" : "opacity-0 group-hover/check:opacity-40")}
      />
    </button>
  );
}

export function TaskRow({
  task,
  today,
  onToggle,
  onOpen,
  showDate = true,
  showArea = true,
  compact = false,
  onReschedule,
}: {
  task: Task;
  today: IsoDate;
  onToggle: () => void;
  onOpen: () => void;
  showDate?: boolean;
  showArea?: boolean;
  compact?: boolean;
  // Botão "Hoje" (aparece ao passar o mouse) para trazer uma tarefa atrasada para o dia.
  onReschedule?: () => void;
}) {
  const { areaById, folderById } = useWorkspace();
  const area = areaById.get(task.area_id);
  const folder = task.folder_id ? folderById.get(task.folder_id) : undefined;
  const open = isOpen(task);
  const overdue = open && task.due_date !== null && task.due_date < today;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      className={cn(
        "group flex cursor-default items-start gap-2.5 rounded-md px-2 text-sm hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none",
        compact ? "py-1" : "py-1.5",
      )}
    >
      <TaskCheckbox task={task} onToggle={onToggle} className={priorityOf(task.priority).className + " mt-0.5"} />
      <div className="min-w-0 flex-1">
        <p className={cn("leading-5", !open && "text-muted-foreground line-through decoration-foreground/30")}>
          {task.title}
        </p>
        {!compact && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {showDate && task.due_date && (
              <span
                className={cn(overdue && "font-medium text-red-600 dark:text-red-400")}
                title={overdue ? formatRelativeDay(task.due_date, today) : undefined}
              >
                {overdue ? formatOverdue(task.due_date, today) : formatRelativeDay(task.due_date, today)}
              </span>
            )}
            {task.start_time && (
              <span className="flex items-center gap-1">
                <ClockIcon className="size-3" />
                {formatTime(task.start_time)}
              </span>
            )}
            {task.recurrence_rule && <RepeatIcon className="size-3" aria-label="Repete" />}
            {showArea && area && (
              <span className="flex min-w-0 items-center gap-1">
                <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: area.color }} />
                <span className="truncate">{folder ? folder.name : area.name}</span>
              </span>
            )}
          </div>
        )}
      </div>
      {onReschedule && open && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReschedule();
          }}
          title="Mover para hoje"
          aria-label={`Mover "${task.title}" para hoje`}
          className="flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <CalendarArrowUpIcon className="size-3.5" aria-hidden="true" />
          Hoje
        </button>
      )}
    </div>
  );
}
