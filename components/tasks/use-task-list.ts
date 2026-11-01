"use client";

import { useState } from "react";
import { toast } from "sonner";

import { createTask, setTaskStatus, trashTask, restoreTask, type TaskInput, updateTask } from "@/lib/actions/tasks";
import type { Task, TaskStatus } from "./meta";

// Lista de tarefas com resposta imediata: a tela muda na hora e volta atrás se o servidor recusar.
export function useTaskList(initial: Task[]) {
  const [tasks, setTasks] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setTasks(initial);
  }

  function patchLocal(id: string, patch: Partial<Task>) {
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  async function update(id: string, patch: Partial<TaskInput>) {
    const before = tasks;
    patchLocal(id, patch as Partial<Task>);
    const result = await updateTask(id, patch);
    if (!result.ok) {
      setTasks(before);
      toast.error(result.error);
    }
    return result.ok;
  }

  async function setStatus(task: Task, status: TaskStatus) {
    const before = tasks;
    const closing = status === "done" || status === "canceled";
    patchLocal(task.id, { status, completed_at: closing ? new Date().toISOString() : null });
    const result = await setTaskStatus(task.id, status);
    if (!result.ok) {
      setTasks(before);
      toast.error(result.error);
      return;
    }
    if (status === "done" && result.data.nextTaskId && task.recurrence_rule) {
      toast.success("Concluída. A próxima ocorrência já está na lista.");
    }
  }

  async function add(input: Pick<TaskInput, "title" | "area_id"> & Partial<TaskInput>) {
    const result = await createTask(input);
    if (!result.ok) {
      toast.error(result.error);
      return null;
    }
    setTasks((list) => [...list, result.data]);
    return result.data;
  }

  async function remove(task: Task) {
    const before = tasks;
    setTasks((list) => list.filter((t) => t.id !== task.id));
    const result = await trashTask(task.id);
    if (!result.ok) {
      setTasks(before);
      toast.error(result.error);
      return;
    }
    toast("Tarefa excluída.", {
      action: {
        label: "Desfazer",
        onClick: async () => {
          const undo = await restoreTask(task.id);
          if (undo.ok) setTasks((list) => [...list, task]);
          else toast.error(undo.error);
        },
      },
    });
  }

  return { tasks, update, setStatus, add, remove };
}

export type TaskList = ReturnType<typeof useTaskList>;
