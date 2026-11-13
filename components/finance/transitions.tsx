"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { formatPercentPtBr } from "@/lib/finance/household";
import { formatCentsToBrl } from "@/lib/money";

export interface SlidingTabItem<T extends string> {
  id: T;
  label: string;
}

interface SlidingTabsProps<T extends string> {
  items: ReadonlyArray<SlidingTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/** Controlador de abas/filtros com pílula deslizante (transitions-dev #16). */
export function SlidingTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
}: SlidingTabsProps<T>) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mountedRef = useRef(false);

  const syncPill = (animate: boolean) => {
    const pill = pillRef.current;
    const activeEl = tabRefs.current[value];
    if (!pill || !activeEl) return;

    if (!animate) pill.style.transition = "none";
    pill.style.width = `${activeEl.offsetWidth}px`;
    pill.style.transform = `translateX(${activeEl.offsetLeft}px)`;
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = "";
    }
  };

  useLayoutEffect(() => {
    syncPill(mountedRef.current);
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, items.length]);

  useEffect(() => {
    const handleResize = () => syncPill(false);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={`t-tabs ${className}`} role="tablist" aria-label={ariaLabel}>
      <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(el) => {
              tabRefs.current[item.id] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className="t-tab"
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

interface SoftTextProps {
  text: string;
  align?: "start" | "center" | "end";
  className?: string;
}

/** Transição cross-blur sem deslocamento brusco para KPIs e totais (transitions-dev #34). */
export function SoftText({ text, align = "start", className = "" }: SoftTextProps) {
  const [prev, setPrev] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  const lastTextRef = useRef(text);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const oldRef = useRef<HTMLSpanElement>(null);
  const newRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (text === lastTextRef.current) return;
    const oldVal = lastTextRef.current;
    lastTextRef.current = text;
    setPrev(oldVal);
    setSwapping(false);

    const raf = requestAnimationFrame(() => {
      const wrap = wrapRef.current;
      const oldEl = oldRef.current;
      const newEl = newRef.current;
      if (wrap && oldEl && newEl) {
        wrap.style.width = `${oldEl.offsetWidth}px`;
        void wrap.offsetWidth;
        setSwapping(true);
        wrap.style.width = `${newEl.offsetWidth}px`;
      } else {
        setSwapping(true);
      }
    });

    const timer = setTimeout(() => {
      setPrev(null);
      setSwapping(false);
      if (wrapRef.current) wrapRef.current.style.width = "";
    }, 240);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <span
      ref={wrapRef}
      style={{ ["--text-soft-align" as string]: align }}
      className={`t-text-soft ${swapping ? "is-swapping" : ""} ${className}`}
    >
      {prev !== null ? (
        <>
          <span ref={oldRef} className="t-text-soft-old">
            {prev}
          </span>
          <span ref={newRef} className="t-text-soft-new">
            {text}
          </span>
        </>
      ) : (
        <span>{text}</span>
      )}
    </span>
  );
}

interface SuccessCheckIconProps {
  active: boolean;
  className?: string;
}

/** Check SVG com path stroke-draw dinâmico (transitions-dev #10). */
export function SuccessCheckIcon({ active, className = "size-3.5" }: SuccessCheckIconProps) {
  const pathRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = Math.ceil(path.getTotalLength()) + 1;
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = active ? "0" : String(len);
  }, [active]);

  return (
    <span className={`t-success-check ${className}`} data-state={active ? "in" : "out"} aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" className={className}>
        <path
          ref={pathRef}
          d="M3 8.5L6.5 12L13 4.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function useAnimatedCounter({
  value,
  resetKey,
  durationMs = 560,
  round = true,
  formatFn,
}: {
  value: number;
  resetKey?: string;
  durationMs?: number;
  round?: boolean;
  formatFn: (val: number) => string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevKeyRef = useRef<string | undefined>(resetKey);
  const displayedRef = useRef<number>(value);
  const hasMountedRef = useRef(false);

  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const keyChanged = prevKeyRef.current !== resetKey;
    const firstMount = !hasMountedRef.current;
    hasMountedRef.current = true;
    prevKeyRef.current = resetKey;

    const from = firstMount || keyChanged ? 0 : displayedRef.current;
    const to = value;

    if (reduced || from === to) {
      displayedRef.current = to;
      el.textContent = formatFn(to);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();
    el.textContent = formatFn(from);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // easeOutExpo: saída rápida e desaceleração refinada até o centavo final (estilo Trust Care)
      const eased = t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const raw = from + (to - from) * eased;
      const current = t >= 1 ? to : round ? Math.round(raw) : Math.round(raw * 10) / 10;
      displayedRef.current = current;
      el.textContent = formatFn(current);
      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [value, resetKey, durationMs, round, formatFn]);

  return spanRef;
}

interface AnimatedBrlProps {
  cents: number;
  signed?: boolean;
  resetKey?: string;
  durationMs?: number;
  className?: string;
}

/** Valor em R$ com contagem suave estilo cartões Trust Care. */
export const AnimatedBrl = memo(function AnimatedBrl({
  cents,
  signed = false,
  resetKey,
  durationMs = 560,
  className = "",
}: AnimatedBrlProps) {
  const formatFn = useCallback(
    (val: number) => {
      const formatted = formatCentsToBrl(val);
      return signed && val > 0 ? `+${formatted}` : formatted;
    },
    [signed],
  );
  const spanRef = useAnimatedCounter({
    value: cents,
    resetKey,
    durationMs,
    round: true,
    formatFn,
  });

  return (
    <span ref={spanRef} className={`tabular-nums ${className}`}>
      {formatFn(cents)}
    </span>
  );
});

interface AnimatedPercentProps {
  value: number;
  signed?: boolean;
  resetKey?: string;
  durationMs?: number;
  className?: string;
}

/** Percentual com contagem suave em formato brasileiro. */
export const AnimatedPercent = memo(function AnimatedPercent({
  value,
  signed = false,
  resetKey,
  durationMs = 520,
  className = "",
}: AnimatedPercentProps) {
  const formatFn = useCallback(
    (val: number) => {
      const prefix = signed && val > 0 ? "+" : val < 0 ? "−" : "";
      return `${prefix}${formatPercentPtBr(Math.abs(val))}%`;
    },
    [signed],
  );
  const spanRef = useAnimatedCounter({
    value,
    resetKey,
    durationMs,
    round: false,
    formatFn,
  });

  return (
    <span ref={spanRef} className={`tabular-nums ${className}`}>
      {formatFn(value)}
    </span>
  );
});

interface MonthSlotLabelProps {
  label: string;
  direction: "next" | "prev" | "fade";
  className?: string;
}

/** Troca direcional contida no seletor < Out 2026 > sem empurrar o restante da tela. */
export function MonthSlotLabel({ label, direction, className = "" }: MonthSlotLabelProps) {
  const [prev, setPrev] = useState<string | null>(null);
  const [slotDir, setSlotDir] = useState<"next" | "prev" | "fade">("fade");
  const lastLabelRef = useRef(label);

  useEffect(() => {
    if (label === lastLabelRef.current) return;
    setPrev(lastLabelRef.current);
    setSlotDir(direction);
    lastLabelRef.current = label;

    const timer = setTimeout(() => {
      setPrev(null);
    }, 250);

    return () => clearTimeout(timer);
  }, [label, direction]);

  return (
    <span className={`t-month-slot ${className}`} data-dir={prev ? slotDir : undefined}>
      {prev !== null ? (
        <>
          <span key={`old-${prev}`} className="t-month-slot-old">
            {prev}
          </span>
          <span key={`new-${label}`} className="t-month-slot-new">
            {label}
          </span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </span>
  );
}

/** Esqueleto estilo cartões Trust Care enquanto a troca de mês demora > 110ms. */
export function FinanceMonthSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="t-kpi-card grid grid-cols-1 items-center gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-12">
        <div className="space-y-2.5 lg:col-span-7">
          <div className="t-skel-shimmer h-3 w-44 rounded" />
          <div className="t-skel-shimmer h-9 w-52 rounded-md" />
          <div className="t-skel-shimmer h-3 w-64 rounded" />
        </div>
        <div className="space-y-2 border-t border-border/60 pt-3 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
          <div className="flex justify-between">
            <div className="t-skel-shimmer h-3 w-28 rounded" />
            <div className="t-skel-shimmer h-3 w-24 rounded" />
          </div>
          <div className="t-skel-shimmer h-2.5 w-full rounded-full" />
          <div className="t-skel-shimmer h-3 w-48 rounded" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="t-kpi-card flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="t-skel-shimmer h-3 w-24 rounded" />
              <div className="t-skel-shimmer h-4 w-16 rounded-full" />
            </div>
            <div className="t-skel-shimmer h-7 w-32 rounded-md" />
            <div className="t-skel-shimmer h-3 w-28 rounded" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="t-kpi-card h-56 rounded-xl border border-border bg-card p-4 lg:col-span-7 xl:col-span-8">
          <div className="t-skel-shimmer h-3.5 w-40 rounded" />
          <div className="mt-6 flex h-32 items-end gap-3 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="t-skel-shimmer flex-1 rounded-t" style={{ height: `${38 + ((i * 19) % 55)}%` }} />
            ))}
          </div>
        </div>
        <div className="t-kpi-card h-56 space-y-3 rounded-xl border border-border bg-card p-4 lg:col-span-5 xl:col-span-4">
          <div className="t-skel-shimmer h-3.5 w-32 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1">
              <div className="t-skel-shimmer h-3 w-36 rounded" />
              <div className="t-skel-shimmer h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
