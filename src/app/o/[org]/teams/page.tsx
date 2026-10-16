import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { listOrgTeams, teamMemberCounts } from "@/server/orgs";
import { mediaUrl } from "@/server/meetings/state";
import { TeamsBrowser } from "@/components/org/teams-browser";

export const metadata = { title: "Teams" };

export default async function OrgTeamsPage({ params }: PageProps<"/o/[org]/teams">) {
  const { org: slug } = await params;
  const user = await requireUser();
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  const { org } = access;
  const teams = await listOrgTeams(org.id, access.isAdmin);
  const counts = await teamMemberCounts(teams.map((t) => t.id));
  const mine = await db.select({ teamId: schema.members.teamId, roles: schema.members.roles }).from(schema.members).where(eq(schema.members.userId, user.id));
  const requests = await db
    .select({ teamId: schema.userRequests.teamId })
    .from(schema.userRequests)
    .where(and(eq(schema.userRequests.orgId, org.id), eq(schema.userRequests.userId, user.id), eq(schema.userRequests.status, "pending")));
  const transparency = !!org.settings.teamTransparency;
  const fullList = access.isAdmin || access.canInsights || org.settings.revealTeamList !== false;
  const rows = teams.filter((t) => fullList || mine.some((m) => m.teamId === t.id)).map((t) => {
    const m = mine.find((x) => x.teamId === t.id);
    const myRole = m ? (m.roles.includes("admin") ? "admin" : m.roles.includes("member") ? "member" : "observer") : null;
    return {
      id: t.id,
      name: t.name,
      color: t.color,
      logoUrl: mediaUrl(t.logoMediaId),
      description: t.description,
      tags: t.tags,
      isProgram: t.isProgram,
      archived: !!t.archivedAt,
      memberCount: counts.get(t.id) ?? 0,
      lastActivityAt: t.lastActivityAt?.toISOString() ?? null,
      myRole: myRole as "admin" | "member" | "observer" | null,
      requested: requests.some((r) => r.teamId === t.id),
      visible: !!m || access.isAdmin || transparency,
    };
  });
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
        <p className="text-sm text-muted-foreground">Every team in {org.name}.</p>
      </div>
      <TeamsBrowser orgId={org.id} teams={rows} isAdmin={access.isAdmin} canCreate={access.isAdmin || !org.settings.restrictTeamCreation} transparency={transparency} />
    </div>
  );
}
