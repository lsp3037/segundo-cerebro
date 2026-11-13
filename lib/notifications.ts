// Tipos dos avisos do sino. Fica fora de arquivos "use client" porque servidor e navegador usam.

export type NotificationGroup = "agora" | "hoje" | "anteriores";
export type NotificationCategory = "tarefas" | "agenda" | "financas" | "entrada";
export type NotificationTone = "blue" | "red" | "amber" | "gray";

export type NotificationAction =
  // Tarefa atrasada: traz para hoje (guarda a data antiga para o "Desfazer").
  | { type: "move-today"; taskId: string; previousDue: string | null }
  // Tarefa com horário: conclui.
  | { type: "complete"; taskId: string }
  // Conta a pagar: marca como paga.
  | { type: "pay"; transactionId: string };

export type AppNotification = {
  // Identidade estável: muda quando o aviso muda (ex.: a contagem da Caixa de Entrada).
  key: string;
  group: NotificationGroup;
  category: NotificationCategory;
  tone: NotificationTone;
  icon: "calendar" | "clock" | "alert" | "wallet" | "inbox";
  title: string;
  detail: string;
  // Destaque em vermelho no começo do detalhe (ex.: "Atrasada há 10 dias").
  urgent?: string;
  time: string;
  href: string;
  action?: NotificationAction;
  read: boolean;
};

export const NOTIFICATION_GROUPS: { value: NotificationGroup; label: string }[] = [
  { value: "agora", label: "Agora" },
  { value: "hoje", label: "Hoje" },
  { value: "anteriores", label: "Anteriores" },
];

export const NOTIFICATION_FILTERS: { value: NotificationCategory | "todas"; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "tarefas", label: "Tarefas" },
  { value: "agenda", label: "Agenda" },
  { value: "financas", label: "Finanças" },
];

// Quantos avisos lidos lembramos (os mais recentes). O resto some sozinho.
export const MAX_READ_KEYS = 300;
