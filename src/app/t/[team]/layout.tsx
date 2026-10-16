import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Eye } from "lucide-react";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { AppHeader } from "@/components/shell/app-header";
import { NavTabs } from "@/components/shell/nav-tabs";
import { RememberOrg } from "@/components/shell/remember-org";
import { TeamLogo } from "@/components/team/team-card";
import { TeamMenu } from "@/components/team/team-menu";
import { Badge } from "@/components/ui/badge";
import { mediaUrl } from "@/server/meetings/state";
import { GettingStarted } from "@/components/shell/getting-started";
import { teamChecklist } from "@/server/getting-started";

export default async function TeamLayout({ children, params }: LayoutProps<"/t/[team]">) {
  const { team: teamId } = await params;
  const user = await requireUser(`/t/${teamId}`);
  const access = await getTeamAccess(user, teamId);
  if (!access) notFound();
  const { team, org } = access;
  const checklist = access.isAdmin && !team.archivedAt ? await teamChecklist(user, team.id) : [];
  const base = `/t/${team.id}`;
  const tabs = [
    { href: base, label: "Home", exact: true },
    { href: `${base}/retrospectives`, label: "Retrospectives" },
    { href: `${base}/standups`, label: "Standups" },
    { href: `${base}/health-checks`, label: "Health checks" },
    { href: `${base}/estimations`, label: "Estimations" },
    { href: `${base}/members`, label: "Members" },
    { href: `${base}/insights`, label: "Insights" },
    ...(access.isAdmin || access.member ? [{ href: `${base}/settings`, label: "Settings" }] : []),
  ];
  const role = access.roles.includes("admin") ? "Admin" : access.isMember ? "Member" : access.roles.includes("observer") ? "Observer" : access.isAdmin ? "Org admin" : "Viewer";
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <RememberOrg slug={org.slug} />
      <AppHeader user={user} org={{ id: org.id, slug: org.slug, name: org.name, color: org.color }} isAdmin={access.orgUser?.roles.includes("admin") || access.orgUser?.roles.includes("owner")} canInsights={!!access.orgUser && (access.orgUser.roles.includes("admin") || access.orgUser.roles.includes("insightsViewer"))} extra={checklist.length ? <GettingStarted items={checklist} total={6} /> : null} />
      <div className="relative border-b bg-background no-print">
        {team.coverMediaId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(team.coverMediaId)!} alt="" className="absolute inset-0 size-full object-cover opacity-20" />
        )}
        <div className="relative mx-auto max-w-7xl px-4 pt-5">
          <div className="flex items-center gap-3">
            <TeamLogo name={team.name} color={team.color} logoUrl={mediaUrl(team.logoMediaId)} size={44} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link href={`/o/${org.slug}`} className="hover:text-foreground">{org.name}</Link>
                <span>/</span>
              </div>
              <h1 className="flex items-center gap-2 truncate text-xl font-semibold tracking-tight">
                {team.name}
                <Badge variant="secondary" className="uppercase">{role}</Badge>
                {team.isProgram && <Badge variant="outline">Program</Badge>}
              </h1>
            </div>
            <div className="ml-auto">
              <TeamMenu teamId={team.id} isAdmin={access.isAdmin} isMember={!!access.member} archived={!!team.archivedAt} code={team.code} canInvite={access.can("addTeamMembers")} />
            </div>
          </div>
          <NavTabs items={tabs} className="mt-3" />
        </div>
      </div>
      {team.archivedAt && (
        <div className="bg-amber-500/15 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
          <Archive className="mr-1 inline size-4" /> This team has been archived and is read-only.
        </div>
      )}
      {access.isViewer && (
        <div className="bg-sky-500/10 py-2 text-center text-sm text-sky-800 dark:text-sky-300">
          <Eye className="mr-1 inline size-4" /> You are viewing this team. Team transparency is enabled for your organization.
        </div>
      )}
      <main className="flex-1">{children}</main>
    </div>
  );
}
