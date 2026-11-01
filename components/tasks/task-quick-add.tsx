"use client";

import { CalendarIcon, PlusIcon } from "lucide-react";
import { useRef, useState } from "react";

import { useWorkspace } from "@/components/workspace";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRelativeDay, type IsoDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskList } from "./use-task-list";

// Campo de "nova tarefa": Enter cria. Área, pasta e data já vêm do contexto da tela.
export function TaskQuickAdd({
  list,
  today,
  defaultAreaId,
  folderId,
  defaultDate,
  placeholder = "Nova tarefa…",
  minimal = false,
  className,
}: {
  list: TaskList;
  today: IsoDate;
  defaultAreaId: string;
  folderId?: string | null;
  defaultDate?: IsoDate | null;
  placeholder?: string;
  // Só o campo de texto (usado nas colunas da semana).
  minimal?: boolean;
  className?: string;
}) {
  const { areas } = useWorkspace();
  const [title, setTitle] = useState("");
  const [areaId, setAreaId] = useState(defaultAreaId);
  const [date, setDate] = useState<IsoDate | "">(defaultDate ?? "");
  const [busy, setBusy] = useState(false);
  const dateInput = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = title.trim();
    if (!text || busy) return;
    setBusy(true);
    const created = await list.add({
      title: text,
      area_id: areaId,
      folder_id: folderId ?? null,
      due_date: date || null,
    });
    setBusy(false);
    if (created) setTitle("");
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/30",
        className,
      )}
    >
      <PlusIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label="Título da nova tarefa"
        maxLength={300}
        className="h-7 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />

      {!folderId && !minimal && (
        <Select value={areaId} onValueChange={setAreaId}>
          <SelectTrigger size="sm" className="h-7 w-auto gap-1.5 border-none px-2 text-xs shadow-none" aria-label="Área">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                <span className="size-2 rounded-full" style={{ backgroundColor: a.color }} />
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {!minimal && (
      <label
        className="relative flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent"
        onClick={() => dateInput.current?.showPicker?.()}
      >
        <CalendarIcon className="size-3.5" />
        <span>{date ? formatRelativeDay(date, today) : "Sem data"}</span>
        <input
          ref={dateInput}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Data"
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
        />
      </label>
      )}
    </form>
  );
}
