export interface UiGenerationRun {
  finished: Promise<HTMLElement>;
  cancel: () => void;
  element: HTMLElement;
}

export interface UiGenerationOptions {
  variant?: "ui" | "text" | "small-text" | "image" | "auto";
  mode?: "skeleton" | "skeleton-texts";
  duration?: number;
  delay?: number;
  steps?: string[];
  done?: string;
  code?: string[] | null;
  title?: string | null;
  maxParts?: number;
  keys?: number;
  onDone?: ((el: HTMLElement) => void) | null;
}

export function generate(
  el: HTMLElement | string,
  options?: UiGenerationOptions
): UiGenerationRun;
