import type { Tables } from "@/lib/supabase/database.types";

export type Task = Tables<"tasks">;
export type TaskStatus = "todo" | "doing" | "waiting" | "done" | "canceled";

export const PRIORITIES = [
  { value: 1, label: "Urgente", className: "text-red-600 dark:text-red-400", ring: "border-red-500" },
  { value: 2, label: "Alta", className: "text-amber-600 dark:text-amber-400", ring: "border-amber-500" },
  { value: 3, label: "Normal", className: "text-muted-foreground", ring: "border-foreground/35" },
  { value: 4, label: "Baixa", className: "text-muted-foreground/70", ring: "border-foreground/20" },
] as const;

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "A fazer" },
  { value: "doing", label: "Fazendo" },
  { value: "waiting", label: "Aguardando" },
  { value: "done", label: "Feito" },
  { value: "canceled", label: "Cancelada" },
];

export function priorityOf(value: number) {
  return PRIORITIES.find((p) => p.value === value) ?? PRIORITIES[2];
}

export function isOpen(task: Pick<Task, "status">) {
  return task.status !== "done" && task.status !== "canceled";
}

// Ordem dentro de um dia: com horário primeiro, depois prioridade.
export function compareTasks(a: Task, b: Task) {
  if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
  if (a.start_time) return -1;
  if (b.start_time) return 1;
  return a.priority - b.priority || a.created_at.localeCompare(b.created_at);
}
