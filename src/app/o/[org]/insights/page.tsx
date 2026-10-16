import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { listOrgTeams } from "@/server/orgs";
import { loadInsights } from "@/server/insights-page";
import { InsightsView } from "@/components/insights/insights-view";
import { aiFeature } from "@/server/ai";

export default async function OrgInsights({ params, searchParams }: PageProps<"/o/[org]/insights">) {
  const { org } = await params;
  const user = await requireUser();
  const access = await getOrgAccess(user, org);
  if (!access?.canInsights) notFound();
  const teams = await listOrgTeams(access.org.id, true);
  const { data, health, range } = await loadInsights(teams.map((t) => t.id), await searchParams);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <InsightsView data={data} health={health} range={range} scope="org" exportBase={`/api/insights/org/${access.org.id}`} aiEnabled={aiFeature(access.org, "insights")} />
    </div>
  );
}
