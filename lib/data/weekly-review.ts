import "server-only";

import { getCurrentUser } from "@/lib/auth";
import { addDays, startOfWeek, todayIso } from "@/lib/dates";
import { getFinanceSummary } from "@/lib/data/finance";
import { getInboxItems } from "@/lib/data/inbox";
import { getTasks, type Task } from "@/lib/data/tasks";
import { getContentIdeas, type ContentIdea } from "@/lib/data/trustcare";
import type { Tables } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type WeeklyReview = Tables<"weekly_reviews">;

export interface WeeklyReviewData {
  weekStart: string; // YYYY-MM-DD
  today: string;
  isCompleted: boolean;
  reviewRecord: WeeklyReview | null;
  openInboxCount: number;
  lateTasks: Task[];
  upcomingTasks: Task[];
  contentIdeasCount: number;
  recentIdeas: ContentIdea[];
  finance: {
    incomeCents: number;
    expenseCents: number;
    balanceCents: number;
  };
  recentHistory: WeeklyReview[];
}

export async function getWeeklyReviewData(targetWeekStart?: string): Promise<WeeklyReviewData> {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const today = todayIso();
  const weekStart = targetWeekStart || startOfWeek(today);

  // Intervalo dos próximos 7 dias
  const next7Days = addDays(today, 7);

  // 1. Busca dados em paralelo
  const [inboxItems, tasks, contentIdeas, financeSummary, currentReviewRes, historyRes] =
    await Promise.all([
      getInboxItems("new"),
      getTasks(),
      getContentIdeas(),
      getFinanceSummary({ month: today.slice(0, 7) }),
      supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user.id)
        .eq("week_start", weekStart)
        .maybeSingle(),
      supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", user.id)
        .order("week_start", { ascending: false })
        .limit(10),
    ]);

  // Filtra tarefas atrasadas e tarefas dos próximos 7 dias
  const lateTasks: Task[] = [];
  const upcomingTasks: Task[] = [];

  for (const t of tasks) {
    if (t.status === "done" || t.status === "cancelled") continue;
    if (t.due_date) {
      if (t.due_date < today) {
        lateTasks.push(t);
      } else if (t.due_date <= next7Days) {
        upcomingTasks.push(t);
      }
    }
  }

  const reviewRecord = currentReviewRes.data ?? null;

  return {
    weekStart,
    today,
    isCompleted: Boolean(reviewRecord?.completed_at),
    reviewRecord,
    openInboxCount: inboxItems.length,
    lateTasks,
    upcomingTasks,
    contentIdeasCount: contentIdeas.length,
    recentIdeas: contentIdeas.slice(0, 5),
    finance: {
      incomeCents: financeSummary.totalIncomeCents,
      expenseCents: financeSummary.totalExpenseCents,
      balanceCents: financeSummary.netBalanceCents,
    },
    recentHistory: historyRes.data ?? [],
  };
}
