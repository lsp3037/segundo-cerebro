import type { Metadata } from "next";

import { MarketingDirectorHub } from "@/components/trustcare/marketing/marketing-director-hub";
import {
  getCampaignAngles,
  getMarketingCampaigns,
  getMarketingContentScripts,
  getMetaAdsMetrics,
} from "@/lib/data/marketing";
import type { Folder } from "@/lib/modules";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Diretoria de Marketing · Trust Care",
};

export default async function MarketingPage() {
  const supabase = await createClient();
  const { data: area } = await supabase.from("areas").select("id").eq("slug", "trustcare").single();
  const { data: folders } = area
    ? await supabase.from("folders").select("id").eq("area_id", area.id).is("deleted_at", null)
    : { data: [] };

  const folderIds = folders?.map((f) => f.id) ?? [];
  const filter = folderIds.length > 0 ? { folderIds } : {};

  const [campaigns, angles, metrics, scripts] = await Promise.all([
    getMarketingCampaigns(filter),
    getCampaignAngles(),
    getMetaAdsMetrics(),
    getMarketingContentScripts(filter),
  ]);

  const virtualFolder: Folder = {
    id: "marketing-virtual",
    name: "Diretoria de Marketing",
    module: "marketing_director",
    area_id: area?.id ?? "",
    parent_id: null,
    icon: "megaphone",
    sort_order: 6,
    config: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    user_id: "",
    collapsed: false,
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <MarketingDirectorHub
        key={`${campaigns.length}-${angles.length}-${metrics.length}`}
        folder={virtualFolder}
        initialCampaigns={campaigns}
        initialAngles={angles}
        initialMetrics={metrics}
        initialScripts={scripts}
      />
    </div>
  );
}
