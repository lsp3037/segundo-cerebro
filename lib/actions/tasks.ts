"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import { nextOccurrence, RECURRENCE_OPTIONS } from "@/lib/recurrence";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { type ActionResult, fail, ok } from "./result";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Horário inválido.");
const rules = RECURRENCE_OPTIONS.map((o) => o.value).filter(Boolean) as [string, ...string[]];

const fields = z.object({
  title: z.string().trim().min(1, "Escreva o título da tarefa.").max(300, "Título muito longo."),
  notes: z.string().max(20_000).nullable(),
  area_id: z.uuid(),
  folder_id: z.uuid().nullable(),
  priority: z.number().int().min(1).max(4),
  status: z.enum(["todo", "doing", "waiting", "done", "canceled"]),
  due_date: isoDate.nullable(),
  start_time: time.nullable(),
  duration_min: z.number().int().min(5).max(24 * 60).nullable(),
  recurrence_rule: z.enum(rules).nullable(),
});

export type TaskInput = z.input<typeof fields>;

function revalidate() {
  revalidatePath("/", "layout");
}

export async function createTask(
  input: Pick<TaskInput, "title" | "area_id"> & Partial<TaskInput>,
): Promise<ActionResult<Tables<"tasks">>> {
  await getCurrentUser();
  const parsed = fields.partial().required({ title: true, area_id: true }).safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const data = parsed.data;
  if (data.start_time && !data.due_date) return fail("Para ter horário, a tarefa precisa de uma data.");

  const supabase = await createClient();
  const { data: task, error } = await supabase.from("tasks").insert(data).select("*").single();
  if (error) return fail("Não foi possível criar a tarefa.");

  revalidate();
  return ok(task);
}

export async function updateTask(taskId: string, patch: Partial<TaskInput>): Promise<ActionResult> {
  await getCurrentUser();
  const parsed = fields.partial().safeParse(patch);
  if (!z.uuid().safeParse(taskId).success || !parsed.success) {
    return fail(parsed.error?.issues[0].message ?? "Tarefa inválida.");
  }

  const supabase = await createClient();
  const data: Partial<Tables<"tasks">> = { ...parsed.data };
  if (data.due_date === null) {
    data.start_time = null;
  }
  if (data.status) {
    const result = await applyStatus(taskId, data.status);
    if (!result.ok) return result;
    delete data.status;
  }
  if (Object.keys(data).length > 0) {
    const { error } = await supabase.from("tasks").update(data).eq("id", taskId);
    if (error) return fail("Não foi possível salvar a tarefa.");
  }

  revalidate();
  return ok();
}

export async function setTaskStatus(
  taskId: string,
  status: Tables<"tasks">["status"],
): Promise<ActionResult<{ nextTaskId: string | null }>> {
  await getCurrentUser();
  if (!z.uuid().safeParse(taskId).success) return fail("Tarefa inválida.");
  const result = await applyStatus(taskId, status);
  if (result.ok) revalidate();
  return result;
}

// Ao concluir uma tarefa que se repete, cria a próxima ocorrência (uma só, mesmo se concluir de novo).
async function applyStatus(
  taskId: string,
  status: string,
): Promise<ActionResult<{ nextTaskId: string | null }>> {
  if (!fields.shape.status.safeParse(status).success) return fail("Status inválido.");
  const supabase = await createClient();

  const { data: task } = await supabase.from("tasks").select("*").eq("id", taskId).single();
  if (!task) return fail("Tarefa não encontrada.");

  const closing = status === "done" || status === "canceled";
  const { error } = await supabase
    .from("tasks")
    .update({ status, completed_at: closing ? (task.completed_at ?? new Date().toISOString()) : null })
    .eq("id", taskId);
  if (error) return fail("Não foi possível atualizar a tarefa.");

  let nextTaskId: string | null = null;
  if (status === "done" && task.recurrence_rule && task.due_date) {
    const rootId = task.recurrence_parent_id ?? task.id;
    const nextDate = nextOccurrence(task.recurrence_rule, task.due_date);

    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("recurrence_parent_id", rootId)
      .eq("due_date", nextDate!)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      nextTaskId = existing.id;
    } else if (nextDate) {
      const { data: created } = await supabase
        .from("tasks")
        .insert({
          area_id: task.area_id,
          folder_id: task.folder_id,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          due_date: nextDate,
          start_time: task.start_time,
          duration_min: task.duration_min,
          recurrence_rule: task.recurrence_rule,
          recurrence_parent_id: rootId,
        })
        .select("id")
        .single();
      nextTaskId = created?.id ?? null;
    }
  }

  return ok({ nextTaskId });
}

export async function trashTask(taskId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!z.uuid().safeParse(taskId).success) return fail("Tarefa inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", taskId);
  if (error) return fail("Não foi possível excluir a tarefa.");

  revalidate();
  return ok();
}

export async function restoreTask(taskId: string): Promise<ActionResult> {
  await getCurrentUser();
  if (!z.uuid().safeParse(taskId).success) return fail("Tarefa inválida.");

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ deleted_at: null }).eq("id", taskId);
  if (error) return fail("Não foi possível restaurar a tarefa.");

  revalidate();
  return ok();
}
