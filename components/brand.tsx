import { cn } from "@/lib/utils";

// Marca simples: dois hemisférios ligados, em traço. Herda a cor do texto.
export function BrainMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("text-foreground", className)}
    >
      <path d="M15 6.5a4.5 4.5 0 0 0-8.6 1.8A4.5 4.5 0 0 0 4 16a4.5 4.5 0 0 0 2.4 7.7A4.5 4.5 0 0 0 15 25.5z" />
      <path d="M17 6.5a4.5 4.5 0 0 1 8.6 1.8A4.5 4.5 0 0 1 28 16a4.5 4.5 0 0 1-2.4 7.7A4.5 4.5 0 0 1 17 25.5z" />
      <path d="M10 13h3M19 13h3M10 19h3M19 19h3" />
    </svg>
  );
}
