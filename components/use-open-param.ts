"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Qual item está aberto no painel lateral. Também abre pelo endereço (ex.: ?tarefa=<id>,
// usado pela busca Ctrl+K) e limpa o endereço ao fechar.
export function useOpenParam(name: string) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fromUrl = searchParams.get(name);

  const [openId, setOpenId] = useState<string | null>(fromUrl);
  const [prev, setPrev] = useState(fromUrl);
  if (prev !== fromUrl) {
    setPrev(fromUrl);
    setOpenId(fromUrl);
  }

  function set(id: string | null) {
    setOpenId(id);
    if (id === null && fromUrl) {
      const params = new URLSearchParams(searchParams);
      params.delete(name);
      router.replace(params.size ? `${pathname}?${params}` : pathname, { scroll: false });
    }
  }

  return [openId, set] as const;
}
