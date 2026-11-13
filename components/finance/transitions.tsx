"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

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
