import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { myAssignedActions, pendingRequests, userTeams } from "@/server/queries";
import { teamMemberCounts } from "@/server/orgs";
import { mediaUrl } from "@/server/meetings/state";
import { TeamCard } from "@/components/team/team-card";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
import { TeamActionPanel } from "@/components/actions/team-action-panel";
import { RequestList } from "@/components/team/request-list";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { MEETING_TYPE_LABEL } from "@/lib/constants";
import type { MeetingType } from "@/lib/types";
import { format, parseISO } from "date-fns";

export default async function OrgHome({ params }: PageProps<"/o/[org]">) {
  const { org: slug } = await params;
  const user = await requireUser();
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  const { org } = access;
  const teams = await userTeams(user.id, org.id);
  const counts = await teamMemberCounts(teams.map((t) => t.team.id));
  const actions = await myAssignedActions(user.id, org.id);
  const requests = access.isAdmin ? await pendingRequests(org.id) : [];
  const myRequests = await db
    .select()
    .from(schema.userRequests)
    .where(and(eq(schema.userRequests.orgId, org.id), eq(schema.userRequests.userId, user.id), eq(schema.userRequests.status, "pending")));
  const teamIds = teams.map((t) => t.team.id);
  const recent = teamIds.length
    ? await db
        .select({ m: schema.meetings, teamName: schema.teams.name, teamColor: schema.teams.color })
        .from(schema.meetings)
        .innerJoin(schema.teams, eq(schema.teams.id, schema.meetings.teamId))
        .where(and(inArray(schema.meetings.teamId, teamIds), isNull(schema.meetings.deletedAt), eq(schema.meetings.isDemo, false)))
        .orderBy(desc(schema.meetings.createdAt))
        .limit(8)
    : [];
  const openCounts = teamIds.length
    ? await db
        .select({ teamId: schema.actionItems.teamId, n: sql<number>`count(*)::int` })
        .from(schema.actionItems)
        .where(and(inArray(schema.actionItems.teamId, teamIds), eq(schema.actionItems.kind, "action"), eq(schema.actionItems.status, "accepted"), isNull(schema.actionItems.deletedAt)))
        .groupBy(schema.actionItems.teamId)
    : [];
  const canCreate = access.isAdmin || !org.settings?.restrictTeamCreation;
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-6 text-center">
          {org.logoMediaId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(org.logoMediaId)!} alt="" className="size-20 rounded-2xl object-cover" />
          ) : (
            <span className="flex size-20 items-center justify-center rounded-2xl text-3xl font-bold text-white" style={{ background: org.color }}>
              {org.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <p className="font-semibold">{org.name}</p>
            <div className="mt-1 flex justify-center gap-1">
              {access.isOwner ? <Badge>Owner</Badge> : access.isAdmin ? <Badge>Admin</Badge> : <Badge variant="secondary">Member</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          <UserAvatar name={user.name} color={user.color} src={mediaUrl(user.avatarMediaId)} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <Link href="/profile" className="text-xs text-primary hover:underline">Edit profile</Link>
          </div>
        </div>
      </aside>
      <div className="space-y-8">
        {!!requests.length && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Requests</h2>
            <RequestList requests={requests} />
          </section>
        )}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your actions</h2>
          {actions.length ? (
            <div className="space-y-2">
              <TeamActionPanel
                teamId={(a) => a.teamId}
                kind="action"
                items={actions}
                members={[{ userId: user.id, name: user.name, color: user.color, avatarUrl: mediaUrl(user.avatarMediaId) }]}
                canManage
                canComplete
                hideAdd
              />
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed bg-card py-6 text-center text-sm text-muted-foreground">You don&apos;t have any assigned actions</p>
          )}
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your teams</h2>
            <CreateTeamDialog orgId={org.id} canCreate={canCreate} />
          </div>
          {myRequests.map((r) => (
            <p key={r.id} className="text-sm text-muted-foreground">
              You requested team <strong>{String(r.data?.name ?? "")}</strong> — waiting for approval.
            </p>
          ))}
          {teams.length ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {teams.map(({ team, member }) => (
                <TeamCard
                  key={team.id}
                  team={{ id: team.id, name: team.name, color: team.color, logoUrl: mediaUrl(team.logoMediaId), archived: !!team.archivedAt, isProgram: team.isProgram }}
                  role={member.roles.includes("admin") ? "Admin" : member.roles.includes("observer") && !member.roles.includes("member") ? "Observer" : null}
                  memberCount={counts.get(team.id)}
                  openActions={openCounts.find((c) => c.teamId === team.id)?.n}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
              <p className="font-medium">No teams yet</p>
              <p className="text-sm text-muted-foreground">You are not currently a member of any teams in {org.name}.</p>
            </div>
          )}
        </section>
        {!!recent.length && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent meetings</h2>
            <ul className="divide-y rounded-2xl border bg-card">
              {recent.map(({ m, teamName, teamColor }) => (
                <li key={m.id}>
                  <Link href={`/m/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <span className="size-2.5 rounded-full" style={{ background: teamColor }} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{m.title || MEETING_TYPE_LABEL[m.type as MeetingType]}</span>{" "}
                      <span className="text-muted-foreground">· {teamName}</span>
                    </span>
                    <Badge variant={m.status === "open" ? "default" : "secondary"}>{m.status === "open" ? "Open" : "Closed"}</Badge>
                    <span className="w-24 text-right text-xs text-muted-foreground">{format(parseISO(m.date), "MMM d, yyyy")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
