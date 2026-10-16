import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { orgUsers, pendingRequests } from "@/server/queries";
import { listOrgTeams } from "@/server/orgs";
import { UsersTable } from "@/components/org/users-table";
import { RequestList } from "@/components/team/request-list";

export const metadata = { title: "Users" };

export default async function OrgUsersPage({ params }: PageProps<"/o/[org]/users">) {
  const { org: slug } = await params;
  const user = await requireUser();
  const access = await getOrgAccess(user, slug);
  if (!access) notFound();
  if (!access.isAdmin) redirect(`/o/${slug}`);
  const [users, teams, requests] = await Promise.all([orgUsers(access.org.id), listOrgTeams(access.org.id), pendingRequests(access.org.id)]);
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Manage who can access {access.org.name} and what they can do.</p>
      </div>
      {requests.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Requests</h2>
          <RequestList requests={requests} />
        </section>
      )}
      <UsersTable orgId={access.org.id} users={users} meId={user.id} isOwner={access.isOwner} teams={teams.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
