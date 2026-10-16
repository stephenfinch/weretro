import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { orgUsers, pendingRequests, teamMembers } from "@/server/queries";
import { MembersTable } from "@/components/team/members-table";
import { RequestList } from "@/components/team/request-list";
import { InviteDialog } from "@/components/team/invite-dialog";

export default async function MembersPage({ params }: PageProps<"/t/[team]/members">) {
  const { team: teamId } = await params;
  const user = await requireUser();
  const access = await getTeamAccess(user, teamId);
  if (!access) notFound();
  const members = await teamMembers(teamId, !!access.org.settings.gravatar);
  const requests = access.isAdmin ? await pendingRequests(access.org.id, teamId) : [];
  const orgPeople = access.can("addTeamMembers") ? (await orgUsers(access.org.id)).filter((u) => u.active && !members.some((m) => m.userId === u.userId)).map((u) => ({ userId: u.userId, name: u.name, email: u.email })) : [];
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Access requests</h2>
          <RequestList requests={requests} />
        </section>
      )}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">Team members</h2>
        <span className="text-sm text-muted-foreground">{members.length}</span>
        <div className="ml-auto">{access.can("addTeamMembers") && !access.team.archivedAt && <InviteDialog teamId={teamId} code={access.team.code} />}</div>
      </div>
      <MembersTable teamId={teamId} members={members} canManage={access.isAdmin} meId={user.id} orgPeople={orgPeople} canAdd={access.can("addTeamMembers")} />
    </div>
  );
}
