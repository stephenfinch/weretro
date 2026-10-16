import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { loadInsights } from "@/server/insights-page";
import { InsightsView } from "@/components/insights/insights-view";
import { aiEnabledFor } from "@/server/ai";

export default async function TeamInsights({ params, searchParams }: PageProps<"/t/[team]/insights">) {
  const { team } = await params;
  const user = await requireUser();
  const access = await getTeamAccess(user, team);
  if (!access) notFound();
  const ids = access.team.isProgram ? [team, ...access.team.memberTeamIds] : [team];
  const { data, health, range } = await loadInsights(ids, await searchParams);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <InsightsView data={data} health={health} range={range} scope={access.team.isProgram ? "org" : "team"} exportBase={`/api/insights/team/${team}`} aiEnabled={aiEnabledFor(access.org)} />
    </div>
  );
}
