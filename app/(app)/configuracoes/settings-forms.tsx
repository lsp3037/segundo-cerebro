"use client";

import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { LgpdNotice } from "@/components/lgpd-notice";
import { THEME_OPTIONS } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateArea } from "@/lib/actions/areas";
import { restoreFolder } from "@/lib/actions/folders";
import { formatDateTime } from "@/lib/dates";
import { type Area, AREA_COLOR_PRESETS } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // O tema só é conhecido no navegador; no servidor nenhuma opção aparece marcada.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex rounded-lg border p-0.5">
      {THEME_OPTIONS.map(({ value, label, icon: ItemIcon }) => {
        const selected = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
              selected ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ItemIcon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AreaSettings({ area }: { area: Area }) {
  const [name, setName] = useState(area.name);
  const [color, setColor] = useState(area.color.toUpperCase());
  const [, startTransition] = useTransition();

  function save(patch: Parameters<typeof updateArea>[1], message?: string) {
    startTransition(async () => {
      const result = await updateArea(area.id, patch);
      if (!result.ok) toast.error(result.error);
      else if (message) toast.success(message);
    });
  }

  function pickColor(value: string) {
    const next = value.toUpperCase();
    setColor(next);
    if (/^#[0-9A-F]{6}$/.test(next) && next !== area.color.toUpperCase()) save({ color: next });
  }

  return (
    <div className="space-y-4 p-4" style={{ "--area": color } as React.CSSProperties}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor={`area-name-${area.id}`}>Nome</Label>
          <Input
            id={`area-name-${area.id}`}
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const trimmed = name.trim();
              if (!trimmed) setName(area.name);
              else if (trimmed !== area.name) save({ name: trimmed }, "Nome da área salvo.");
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`area-color-${area.id}`}>Cor</Label>
          <div className="flex items-center gap-1.5">
            {AREA_COLOR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => pickColor(preset)}
                aria-label={`Usar a cor ${preset}`}
                className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: preset }}
              >
                {preset === color && <CheckIcon className="size-3.5 text-white" />}
              </button>
            ))}
            <input
              id={`area-color-${area.id}`}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value.toUpperCase())}
              onBlur={(e) => pickColor(e.target.value)}
              title="Outra cor"
              className="ml-1 size-7 cursor-pointer rounded border bg-transparent p-0.5"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleRow
          id={`area-ai-${area.id}`}
          label="Pode ir para a IA"
          hint={area.ai_enabled ? "Conteúdo desta área pode ser enviado ao Gemini." : "Nada desta área é enviado ao Gemini."}
          checked={area.ai_enabled}
          onChange={(ai_enabled) => save({ ai_enabled })}
        />
        <ToggleRow
          id={`area-lgpd-${area.id}`}
          label="Mostrar aviso LGPD"
          hint="Lembrete discreto nos formulários desta área."
          checked={area.show_lgpd_notice}
          onChange={(show_lgpd_notice) => save({ show_lgpd_notice })}
        />
      </div>

      {area.show_lgpd_notice && <LgpdNotice />}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const [value, setValue] = useState(checked);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={value}
        onCheckedChange={(next) => {
          setValue(next);
          onChange(next);
        }}
        className="data-checked:bg-(--area)"
      />
    </div>
  );
}

export function TrashList({
  folders,
  areas,
}: {
  folders: { id: string; name: string; area_id: string; deleted_at: string | null }[];
  areas: Area[];
}) {
  const [pending, startTransition] = useTransition();

  if (folders.length === 0) {
    return <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">A lixeira está vazia.</p>;
  }

  return (
    <ul className="divide-y rounded-xl border">
      {folders.map((folder) => {
        const area = areas.find((a) => a.id === folder.area_id);
        return (
          <li key={folder.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: area?.color }} />
            <span className="min-w-0 flex-1 truncate">
              {folder.name}
              <span className="text-muted-foreground"> · {area?.name}</span>
            </span>
            {folder.deleted_at && (
              <span className="hidden text-xs text-muted-foreground sm:inline">{formatDateTime(folder.deleted_at)}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await restoreFolder(folder.id);
                  if (result.ok) toast.success("Pasta restaurada.");
                  else toast.error(result.error);
                })
              }
            >
              <RotateCcwIcon />
              Restaurar
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
