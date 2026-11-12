"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

import {
  generate,
  type UiGenerationOptions,
  type UiGenerationRun,
} from "@/lib/motion/ui-generation/ui-generation";

interface UiGenerationRevealProps {
  /** Incremente apenas no momento em que o usuário disparar uma geração/bootstrap real. */
  triggerKey: number | string | null | undefined;
  children: ReactNode;
  variant?: UiGenerationOptions["variant"];
  mode?: UiGenerationOptions["mode"];
  duration?: number;
  delay?: number;
  steps?: string[];
  done?: string;
  className?: string;
}

export function UiGenerationReveal({
  triggerKey,
  children,
  variant = "ui",
  mode = "skeleton",
  duration = 1600,
  delay = 0,
  steps,
  done,
  className,
}: UiGenerationRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !triggerKey) return;

    let cancelled = false;
    let run: UiGenerationRun | null = null;

    const start = async () => {
      if (variant !== "ui" && typeof document !== "undefined" && document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // Segue mesmo se fonts.ready rejeitar
        }
      }
      if (cancelled || !ref.current) return;
      run = generate(ref.current, {
        variant,
        mode,
        duration,
        delay,
        steps,
        done,
      });
    };

    void start();

    return () => {
      cancelled = true;
      run?.cancel();
    };
  }, [triggerKey, variant, mode, duration, delay, steps, done]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
