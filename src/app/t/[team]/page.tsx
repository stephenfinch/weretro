import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { teamActionItems, teamMeetings, teamMembers } from "@/server/queries";
import { startDialogData } from "@/server/team-data";
import { StartMeetingDialog } from "@/components/meeting-setup/start-meeting-dialog";
import { MeetingCard } from "@/components/meetings/meeting-card";
import { TeamActionsSection, TeamListSection } from "@/components/team/team-home-sections";
import { UserAvatar } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/shell/auto-refresh";
import { InviteDialog } from "@/components/team/invite-dialog";
import { Button } from "@/components/ui/button";

export default async function TeamHome({ params, searchParams }: PageProps<"/t/[team]">) {
  const { team: teamId } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const access = await getTeamAccess(user, teamId);
  if (!access) notFound();
  const { team } = access;
  const [members, actions, agreements, parked, open, dialog, integrations] = await Promise.all([
    teamMembers(teamId),
    teamActionItems(teamId, user.id, { kind: "action", includeDone: true }),
    teamActionItems(teamId, user.id, { kind: "agreement" }),
    teamActionItems(teamId, user.id, { kind: "parked" }),
    teamMeetings(teamId, undefined, { status: "open", limit: 30 }),
    startDialogData(access),
    db.select({ id: schema.integrations.id, type: schema.integrations.type, name: schema.integrations.name }).from(schema.integrations).where(eq(schema.integrations.teamId, teamId)),
  ]);
  const standupSeries = await db
    .select()
    .from(schema.meetingSeries)
    .where(and(eq(schema.meetingSeries.teamId, teamId), eq(schema.meetingSeries.type, "standup")));
  void standupSeries;
  const memberLite = members.map((m) => ({ userId: m.userId, name: m.name, color: m.color, avatarUrl: m.avatarUrl }));
  const me = memberLite.find((m) => m.userId === user.id);
  const orderedMembers = me ? [me, ...memberLite.filter((m) => m.userId !== user.id)] : memberLite;
  const canStart = dialog.allowed.length > 0;
  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[320px_1fr]">
      <AutoRefresh />
      {sp.welcome && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 lg:col-span-2">
          <p className="font-semibold">Welcome to {team.name}! 🎉</p>
          <p className="text-sm text-muted-foreground">Invite your teammates, then start your first retrospective, standup, health check or estimation.</p>
        </div>
      )}
      <aside className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open meetings</h2>
          <div className="space-y-3">
            {open.map((m) => (
              <MeetingCard key={m.id} m={m} compact />
            ))}
            {canStart && !team.archivedAt ? (
              <StartMeetingDialog
                {...dialog}
                trigger={
                  <button type="button" className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-6 text-sm font-semibold uppercase tracking-wide text-primary transition hover:border-primary hover:bg-primary/10">
                    <Plus className="size-6" /> Start a meeting
                  </button>
                }
              />
            ) : (
              !open.length && <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Meetings started by team admins will appear here</p>
            )}
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
            {access.can("addTeamMembers") && (
              <InviteDialog
                teamId={team.id}
                code={team.code}
                trigger={
                  <Button variant="ghost" size="icon-xs" aria-label="Invite members">
                    <Plus />
                  </Button>
                }
              />
            )}
            <Link href={`/t/${team.id}/members`} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              {members.length} {members.length === 1 ? "member" : "members"}
            </Link>
          </div>
          <ul className="space-y-1.5">
            {members.slice(0, 12).map((m) => (
              <li key={m.userId} className="flex items-center gap-2.5 text-sm">
                <UserAvatar name={m.name} color={m.color} src={m.avatarUrl} size={28} />
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                {m.roles.includes("admin") && <Badge variant="secondary" className="text-[10px] uppercase">Admin</Badge>}
                {m.roles.includes("observer") && !m.roles.includes("member") && <Badge variant="outline" className="text-[10px] uppercase">Observer</Badge>}
                {m.invited && <Badge variant="outline" className="text-[10px] uppercase">Invited</Badge>}
              </li>
            ))}
            {members.length > 12 && (
              <li>
                <Link href={`/t/${team.id}/members`} className="text-xs text-primary hover:underline">
                  Show {members.length - 12} more…
                </Link>
              </li>
            )}
          </ul>
        </section>
      </aside>
      <div className="space-y-10">
        <TeamActionsSection
          teamId={team.id}
          actions={actions}
          members={orderedMembers}
          canManage={access.can("manageActions")}
          canComplete={access.can("markActionsComplete")}
          reminders={access.member?.reminders ?? "assignedToMe"}
          integrations={integrations}
        />
        <TeamListSection teamId={team.id} kind="agreement" title="Team agreements" items={agreements} members={orderedMembers} canManage={access.can("manageAgreements")} integrations={integrations} />
        <TeamListSection teamId={team.id} kind="parked" title="Parking lot" items={parked} members={orderedMembers} canManage={access.can("manageParkingLot")} integrations={integrations} />
      </div>
    </div>
  );
}
