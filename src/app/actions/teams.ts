"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { assertTeamAccess, getOrgAccess, HttpError } from "@/server/access";
import { addTeamMember, createTeam, ensureOrgUser, inviteToTeam, randomCode } from "@/server/orgs";
import { updateActionItem } from "@/server/meetings/ops";
import { bumpTeamMeetings } from "@/server/team-events";
import { notifyAssigned, teamAdminEmails } from "@/server/notifications";
import { dispatchEvent } from "@/server/integrations/events";
import { layout, sendMail, escapeHtml } from "@/server/email";
import { appUrl } from "@/server/auth";
import type { TeamOptions, TeamRole } from "@/lib/types";
import { logActivity } from "@/server/activity";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

// ── Action items (team level) ─────────────────────────────────────────────

const PERM_FOR_KIND = { action: "manageActions", agreement: "manageAgreements", parked: "manageParkingLot" } as const;

export async function addTeamItem(teamId: string, kind: "action" | "agreement" | "parked", input: { title: string; assigneeIds?: string[]; dueDate?: string | null; priority?: string | null }) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId, PERM_FOR_KIND[kind]);
    const title = input.title.trim().slice(0, 1000);
    if (!title) throw new HttpError(400, "Text is required");
    const [p] = await db.select({ m: max(schema.actionItems.position) }).from(schema.actionItems).where(and(eq(schema.actionItems.teamId, teamId), eq(schema.actionItems.kind, kind)));
    const [a] = await db
      .insert(schema.actionItems)
      .values({ teamId, kind, title, assigneeIds: input.assigneeIds ?? [], dueDate: input.dueDate ?? null, priority: input.priority ?? null, createdById: user.id, position: (p?.m ?? 0) + 1 })
      .returning();
    void dispatchEvent(teamId, kind === "agreement" ? "agreement.created" : "action.created", { id: a.id, title });
    if (input.assigneeIds?.length) void notifyAssigned(teamId, title, input.assigneeIds, user);
    await bumpTeamMeetings(teamId);
    revalidatePath(`/t/${teamId}`);
    return { id: a.id };
  });
}

export async function updateTeamItem(teamId: string, id: string, patch: Record<string, unknown>) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    const [a] = await db.select().from(schema.actionItems).where(and(eq(schema.actionItems.id, id), eq(schema.actionItems.teamId, teamId))).limit(1);
    if (!a) throw new HttpError(404, "Item not found");
    const onlyStatus = Object.keys(patch).every((k) => k === "status");
    const perm = onlyStatus && (patch.status === "completed" || patch.status === "accepted") && a.kind === "action" ? "markActionsComplete" : PERM_FOR_KIND[a.kind as keyof typeof PERM_FOR_KIND];
    if (!access.can(perm)) throw new HttpError(403, "You don't have permission to do that");
    await updateActionItem(user.id, a, patch);
    if (Array.isArray(patch.assigneeIds)) {
      const added = (patch.assigneeIds as string[]).filter((x) => !a.assigneeIds.includes(x));
      if (added.length) void notifyAssigned(teamId, a.title, added, user);
    }
    await bumpTeamMeetings(teamId);
    revalidatePath(`/t/${teamId}`);
  });
}

export async function deleteTeamItem(teamId: string, id: string) {
  return wrap(async () => {
    const user = await requireUser();
    const [a] = await db.select().from(schema.actionItems).where(and(eq(schema.actionItems.id, id), eq(schema.actionItems.teamId, teamId))).limit(1);
    if (!a) throw new HttpError(404, "Item not found");
    await assertTeamAccess(user, teamId, PERM_FOR_KIND[a.kind as keyof typeof PERM_FOR_KIND]);
    await db.update(schema.actionItems).set({ deletedAt: new Date() }).where(eq(schema.actionItems.id, id));
    await bumpTeamMeetings(teamId);
    revalidatePath(`/t/${teamId}`);
  });
}

export async function reorderTeamItems(teamId: string, ids: string[]) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId, "manageActions");
    for (const [i, id] of ids.entries()) await db.update(schema.actionItems).set({ position: i + 1 }).where(and(eq(schema.actionItems.id, id), eq(schema.actionItems.teamId, teamId)));
    await bumpTeamMeetings(teamId);
    revalidatePath(`/t/${teamId}`);
  });
}

export async function setReminderPreference(teamId: string, reminders: "all" | "assignedToMe" | "none") {
  return wrap(async () => {
    const user = await requireUser();
    await db.update(schema.members).set({ reminders }).where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, user.id)));
    revalidatePath(`/t/${teamId}`);
  });
}

export async function shareActionsByEmail(teamId: string, input: { recipients: string[]; scope: "all" | "assigned"; meetingId?: string }) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    const rows = await db
      .select()
      .from(schema.actionItems)
      .where(and(eq(schema.actionItems.teamId, teamId), eq(schema.actionItems.kind, "action"), eq(schema.actionItems.status, "accepted"), isNull(schema.actionItems.deletedAt)));
    const list = input.scope === "assigned" ? rows.filter((r) => r.assigneeIds.length) : rows;
    const html = layout(
      `${access.team.name}: open actions`,
      `<p>${escapeHtml(user.name)} shared the team's open actions with you.</p><ul>${list.map((a) => `<li>${escapeHtml(a.title)}${a.dueDate ? ` <em>(due ${a.dueDate})</em>` : ""}</li>`).join("") || "<li>No open actions</li>"}</ul>`,
      { label: input.meetingId ? "View meeting report" : "Open team", href: appUrl(input.meetingId ? `/m/${input.meetingId}/report` : `/t/${teamId}`) },
    );
    for (const to of input.recipients.filter((e) => /@/.test(e))) await sendMail({ to, subject: `${access.team.name} actions`, html });
    return { sent: input.recipients.length };
  });
}

// ── Teams ─────────────────────────────────────────────────────────────────

export async function createTeamAction(orgId: string, input: { name: string; description?: string; color?: string; inviteEmails?: string[]; adminEmails?: string[]; isProgram?: boolean; memberTeamIds?: string[] }) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await getOrgAccess(user, orgId);
    if (!access) throw new HttpError(404, "Organization not found");
    if (access.org.settings?.restrictTeamCreation && !access.isAdmin) throw new HttpError(403, "Only admins can create teams. Request one instead.");
    if (!input.name.trim()) throw new HttpError(400, "Team name is required");
    const team = await createTeam(user, access.org.id, input);
    if (input.adminEmails?.length) await inviteToTeam(user, team.id, input.adminEmails, "admin");
    if (input.inviteEmails?.length) await inviteToTeam(user, team.id, input.inviteEmails, "member");
    revalidatePath(`/o/${access.org.slug}`);
    return { id: team.id };
  });
}

export async function requestTeamAction(orgId: string, input: { name: string; message?: string }) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await getOrgAccess(user, orgId);
    if (!access) throw new HttpError(404, "Organization not found");
    await db.insert(schema.userRequests).values({ orgId: access.org.id, userId: user.id, kind: "createTeam", data: { name: input.name, message: input.message ?? "" } });
    revalidatePath(`/o/${access.org.slug}`);
  });
}

export async function updateTeamAction(teamId: string, patch: { name?: string; description?: string; color?: string; tags?: string[]; language?: string; logoMediaId?: string | null; coverMediaId?: string | null; options?: TeamOptions; defaultHealthModelId?: string | null; defaultDeckId?: string | null; memberTeamIds?: string[] }) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only team admins can change settings");
    const values: Partial<typeof schema.teams.$inferInsert> = {};
    if (patch.name !== undefined) values.name = patch.name.trim().slice(0, 100) || access.team.name;
    if (patch.description !== undefined) values.description = patch.description.slice(0, 1000);
    if (patch.color !== undefined) values.color = patch.color;
    if (patch.tags !== undefined) values.tags = patch.tags.map((t) => t.trim()).filter(Boolean).slice(0, 20);
    if (patch.language !== undefined) values.language = patch.language;
    if (patch.logoMediaId !== undefined) values.logoMediaId = patch.logoMediaId;
    if (patch.coverMediaId !== undefined) values.coverMediaId = patch.coverMediaId;
    if (patch.options !== undefined) values.options = { ...access.team.options, ...patch.options };
    if (patch.defaultHealthModelId !== undefined) values.defaultHealthModelId = patch.defaultHealthModelId;
    if (patch.defaultDeckId !== undefined) values.defaultDeckId = patch.defaultDeckId;
    if (patch.memberTeamIds !== undefined) values.memberTeamIds = patch.memberTeamIds;
    await db.update(schema.teams).set(values).where(eq(schema.teams.id, teamId));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function regenerateTeamCode(teamId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId, "addTeamMembers");
    const code = randomCode();
    await db.update(schema.teams).set({ code }).where(eq(schema.teams.id, access.team.id));
    revalidatePath(`/t/${teamId}`, "layout");
    return { code };
  });
}

export async function archiveTeamAction(teamId: string, archived: boolean) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only admins can archive teams");
    await db.update(schema.teams).set({ archivedAt: archived ? new Date() : null }).where(eq(schema.teams.id, teamId));
    if (archived) await db.update(schema.meetings).set({ status: "closed", closedAt: new Date() }).where(and(eq(schema.meetings.teamId, teamId), eq(schema.meetings.status, "open")));
    await logActivity({ orgId: access.team.orgId, teamId, userId: user.id, action: archived ? "team.archive" : "team.unarchive" });
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function deleteTeamAction(teamId: string) {
  const user = await requireUser();
  const access = await assertTeamAccess(user, teamId);
  if (!access.isAdmin) throw new HttpError(403, "Only admins can delete teams");
  await db.update(schema.teams).set({ deletedAt: new Date() }).where(eq(schema.teams.id, teamId));
  await logActivity({ orgId: access.team.orgId, teamId, userId: user.id, action: "team.delete" });
  redirect(`/o/${access.org.slug}`);
}

export async function leaveTeamAction(teamId: string) {
  const user = await requireUser();
  const access = await assertTeamAccess(user, teamId);
  await db.delete(schema.members).where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, user.id)));
  redirect(`/o/${access.org.slug}`);
}

export async function joinTeamAction(teamId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Request access instead");
    await addTeamMember(teamId, user.id, ["member"]);
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function requestTeamAccess(teamId: string, role: "member" | "admin") {
  return wrap(async () => {
    const user = await requireUser();
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    if (!team) throw new HttpError(404, "Team not found");
    const access = await getOrgAccess(user, team.orgId);
    if (!access) throw new HttpError(403, "Not in this organization");
    await db.insert(schema.userRequests).values({ orgId: team.orgId, teamId, userId: user.id, kind: role === "admin" ? "teamAdmin" : "teamMember" });
    for (const admin of await teamAdminEmails(teamId)) {
      await sendMail({
        to: admin.email!,
        subject: `${user.name} requested access to ${team.name}`,
        html: layout("Access request", `<p>${escapeHtml(user.name)} has requested to be ${role === "admin" ? "an admin" : "a member"} of <strong>${escapeHtml(team.name)}</strong>.</p>`, { label: "Review request", href: appUrl(`/t/${teamId}/members`) }),
      });
    }
    revalidatePath(`/o/${access.org.slug}/teams`);
  });
}

export async function resolveRequest(requestId: string, accept: boolean) {
  return wrap(async () => {
    const user = await requireUser();
    const [r] = await db.select().from(schema.userRequests).where(eq(schema.userRequests.id, requestId)).limit(1);
    if (!r) throw new HttpError(404, "Request not found");
    if (r.userId === user.id && !accept) {
      await db.update(schema.userRequests).set({ status: "canceled", resolvedAt: new Date() }).where(eq(schema.userRequests.id, r.id));
      return;
    }
    const orgAccess = await getOrgAccess(user, r.orgId);
    const teamAccess = r.teamId ? await assertTeamAccess(user, r.teamId).catch(() => null) : null;
    if (!orgAccess?.isAdmin && !teamAccess?.isAdmin) throw new HttpError(403, "Only admins can resolve requests");
    if (accept) {
      if (r.kind === "createTeam") {
        const [requester] = await db.select().from(schema.users).where(eq(schema.users.id, r.userId)).limit(1);
        await createTeam(requester, r.orgId, { name: String(r.data?.name ?? "New team") });
      } else if (r.teamId) {
        await addTeamMember(r.teamId, r.userId, r.kind === "teamAdmin" ? ["admin"] : ["member"], user.id);
      }
    }
    await db.update(schema.userRequests).set({ status: accept ? "accepted" : "declined", resolvedById: user.id, resolvedAt: new Date() }).where(eq(schema.userRequests.id, r.id));
    revalidatePath("/", "layout");
  });
}

// ── Members ───────────────────────────────────────────────────────────────

export async function inviteMembersAction(teamId: string, emails: string[], role: TeamRole = "member") {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId, "addTeamMembers");
    const invited = await inviteToTeam(user, teamId, emails, role);
    revalidatePath(`/t/${teamId}`, "layout");
    return { invited };
  });
}

export async function addExistingUsersAction(teamId: string, userIds: string[], role: TeamRole = "member") {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId, "addTeamMembers");
    for (const id of userIds) {
      await ensureOrgUser(access.team.orgId, id, user.id);
      await addTeamMember(teamId, id, [role], user.id);
    }
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function setMemberRole(teamId: string, userId: string, role: TeamRole) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only team admins can change roles");
    const roles = role === "admin" ? ["admin", "member"] : [role];
    if (userId === user.id && role !== "admin") {
      const admins = await db.select({ id: schema.members.id }).from(schema.members).where(and(eq(schema.members.teamId, teamId), sql`'admin' = ANY(${schema.members.roles})`));
      if (admins.length <= 1 && !access.orgUser?.roles.includes("admin")) throw new HttpError(400, "A team needs at least one admin");
    }
    await db.update(schema.members).set({ roles }).where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, userId)));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function removeMember(teamId: string, userId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin && userId !== user.id) throw new HttpError(403, "Only team admins can remove members");
    await db.delete(schema.members).where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, userId)));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function resendInvite(teamId: string, userId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId, "addTeamMembers");
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!u?.email) throw new HttpError(400, "No email address");
    const { sendTeamInvite } = await import("@/server/orgs");
    await sendTeamInvite(user, access.team.name, teamId, u.email, u.id);
  });
}

export async function setMemberTags(teamId: string, userId: string, tags: string[]) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only team admins can tag members");
    await db.update(schema.members).set({ tags }).where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, userId)));
    revalidatePath(`/t/${teamId}/members`);
  });
}

export async function restoreMeeting(teamId: string, meetingId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only admins can restore meetings");
    await db.update(schema.meetings).set({ deletedAt: null }).where(and(eq(schema.meetings.id, meetingId), eq(schema.meetings.teamId, teamId)));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function restoreSeries(teamId: string, seriesId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only admins can restore meetings");
    await db.update(schema.meetingSeries).set({ deletedAt: null }).where(and(eq(schema.meetingSeries.id, seriesId), eq(schema.meetingSeries.teamId, teamId)));
    await db.update(schema.meetings).set({ deletedAt: null }).where(eq(schema.meetings.seriesId, seriesId));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function bulkUserIds(ids: string[]) {
  if (!ids.length) return [];
  return db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids));
}
