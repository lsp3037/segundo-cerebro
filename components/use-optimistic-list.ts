"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/actions/result";

// Lista que muda na hora e volta atrás se o servidor recusar. Acompanha os dados novos do servidor.
export function useOptimisticList<T extends { id: string }>(initial: T[]) {
  const [items, setItems] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setItems(initial);
  }

  async function patch(id: string, changes: Partial<T>, call: () => Promise<ActionResult<unknown>>) {
    const before = items;
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...changes } : item)));
    const result = await call();
    if (!result.ok) {
      setItems(before);
      toast.error(result.error);
    }
    return result.ok;
  }

  async function removeItem(id: string, call: () => Promise<ActionResult<unknown>>) {
    const before = items;
    setItems((list) => list.filter((item) => item.id !== id));
    const result = await call();
    if (!result.ok) {
      setItems(before);
      toast.error(result.error);
    }
    return result.ok;
  }

  return { items, setItems, patch, removeItem };
}
