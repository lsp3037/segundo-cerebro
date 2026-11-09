import type { Metadata } from "next";

import { WeeklyReviewDashboard } from "@/components/review/weekly-review-dashboard";
import { getWeeklyReviewData } from "@/lib/data/weekly-review";
import { TABS } from "@/lib/modules";

const tab = TABS[7];

export const metadata: Metadata = { title: tab.label };

export default async function Page(props: PageProps<"/revisao">) {
  const searchParams = await props.searchParams;
  const weekStart =
    typeof searchParams.w === "string" && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.w)
      ? searchParams.w
      : undefined;

  const data = await getWeeklyReviewData(weekStart);

  return <WeeklyReviewDashboard initialData={data} />;
}
