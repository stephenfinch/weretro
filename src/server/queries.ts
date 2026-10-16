import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { mediaUrl, toActionDTO } from "./meetings/state";
import type { ActionDTO } from "@/lib/meeting-types";

export async function userTeams(userId: string, orgId?: string) {
  return db
    .select({ team: schema.teams, member: schema.members })
    .from(schema.members)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.members.teamId))
    .where(and(eq(schema.members.userId, userId), isNull(schema.teams.deletedAt), orgId ? eq(schema.teams.orgId, orgId) : undefined))
    .orderBy(asc(schema.teams.name));
}

export async function teamMembers(teamId: string) {
  const rows = await db
    .select({ m: schema.members, u: schema.users })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.teamId, teamId))
    .orderBy(asc(schema.users.name));
  return rows.map(({ m, u }) => ({
    memberId: m.id,
    userId: u.id,
    name: u.name,
    email: u.email,
    color: u.color,
    initials: u.initials,
    avatarUrl: mediaUrl(u.avatarMediaId),
    roles: m.roles,
    invited: !m.joinedAt,
    lastSeenAt: (m.lastSeenAt ?? u.lastSeenAt)?.toISOString() ?? null,
    reminders: m.reminders,
    tags: m.tags,
  }));
}
export type TeamMemberRow = Awaited<ReturnType<typeof teamMembers>>[number];

export async function teamActionItems(teamId: string, viewerId: string, opts: { kind?: "action" | "agreement" | "parked"; includeDone?: boolean; assignedTo?: string } = {}): Promise<ActionDTO[]> {
  const rows = await db
    .select()
    .from(schema.actionItems)
    .where(
      and(
        eq(schema.actionItems.teamId, teamId),
        isNull(schema.actionItems.deletedAt),
        opts.kind ? eq(schema.actionItems.kind, opts.kind) : undefined,
        opts.includeDone ? notInArray(schema.actionItems.status, ["proposed", "suggested", "rejected"]) : notInArray(schema.actionItems.status, ["proposed", "suggested", "rejected", "completed", "canceled"]),
        opts.assignedTo ? sql`${opts.assignedTo} = ANY(${schema.actionItems.assigneeIds})` : undefined,
      ),
    )
    .orderBy(asc(schema.actionItems.position), asc(schema.actionItems.createdAt));
  return toActionDTOs(rows, viewerId);
}

export async function toActionDTOs(rows: (typeof schema.actionItems.$inferSelect)[], viewerId: string) {
  const userIds = [...new Set(rows.flatMap((r) => r.assigneeIds))];
  const users = userIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const ids = rows.map((r) => r.id);
  const votes = ids.length ? await db.select().from(schema.actionVotes).where(inArray(schema.actionVotes.actionId, ids)) : [];
  const counts = ids.length
    ? await db
        .select({ targetId: schema.comments.targetId, n: sql<number>`count(*)::int` })
        .from(schema.comments)
        .where(and(inArray(schema.comments.targetId, ids), isNull(schema.comments.deletedAt)))
        .groupBy(schema.comments.targetId)
    : [];
  const map = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => toActionDTO(r, map, votes, counts, viewerId));
}

export async function myAssignedActions(userId: string, orgId: string) {
  const rows = await db
    .select({ a: schema.actionItems, team: schema.teams })
    .from(schema.actionItems)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.actionItems.teamId))
    .where(
      and(
        eq(schema.teams.orgId, orgId),
        isNull(schema.teams.deletedAt),
        isNull(schema.actionItems.deletedAt),
        eq(schema.actionItems.kind, "action"),
        eq(schema.actionItems.status, "accepted"),
        sql`${userId} = ANY(${schema.actionItems.assigneeIds})`,
      ),
    )
    .orderBy(asc(schema.actionItems.dueDate), desc(schema.actionItems.createdAt));
  const dtos = await toActionDTOs(rows.map((r) => r.a), userId);
  return dtos.map((d, i) => ({ ...d, teamName: rows[i].team.name, teamColor: rows[i].team.color }));
}

export async function teamMeetings(teamId: string, type?: string, opts: { status?: "open" | "closed"; limit?: number; q?: string } = {}) {
  const rows = await db
    .select()
    .from(schema.meetings)
    .where(
      and(
        eq(schema.meetings.teamId, teamId),
        isNull(schema.meetings.deletedAt),
        eq(schema.meetings.isDemo, false),
        type ? eq(schema.meetings.type, type) : undefined,
        opts.status ? eq(schema.meetings.status, opts.status) : undefined,
        opts.q ? sql`(${schema.meetings.title} ilike ${"%" + opts.q + "%"} or ${schema.meetings.templateName} ilike ${"%" + opts.q + "%"})` : undefined,
      ),
    )
    .orderBy(desc(schema.meetings.date), desc(schema.meetings.createdAt))
    .limit(opts.limit ?? 200);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const ideaCounts = await db
    .select({ meetingId: schema.ideas.meetingId, n: sql<number>`count(*)::int` })
    .from(schema.ideas)
    .where(inArray(schema.ideas.meetingId, ids))
    .groupBy(schema.ideas.meetingId);
  const actionCounts = await db
    .select({ meetingId: schema.actionItems.meetingId, n: sql<number>`count(*)::int` })
    .from(schema.actionItems)
    .where(and(inArray(schema.actionItems.meetingId, ids), eq(schema.actionItems.kind, "action"), isNull(schema.actionItems.deletedAt), ne(schema.actionItems.status, "rejected")))
    .groupBy(schema.actionItems.meetingId);
  const parts = await db
    .select({ meetingId: schema.participants.meetingId, u: schema.users, joined: schema.participants.joinedAt, role: schema.participants.role })
    .from(schema.participants)
    .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
    .where(inArray(schema.participants.meetingId, ids));
  const updates = await db
    .select({ meetingId: schema.standupUpdates.meetingId, n: sql<number>`count(*)::int`, blocked: sql<number>`count(*) filter (where ${schema.standupUpdates.type} = 'blocked')::int` })
    .from(schema.standupUpdates)
    .where(inArray(schema.standupUpdates.meetingId, ids))
    .groupBy(schema.standupUpdates.meetingId);
  return rows.map((m) => ({
    id: m.id,
    type: m.type,
    title: m.title,
    date: m.date,
    status: m.status,
    templateName: m.templateName,
    topics: m.topics,
    anonymity: m.anonymity,
    seriesId: m.seriesId,
    stepKey: m.steps[m.stepIndex]?.key ?? null,
    createdAt: m.createdAt.toISOString(),
    closedAt: m.closedAt?.toISOString() ?? null,
    ideaCount: ideaCounts.find((c) => c.meetingId === m.id)?.n ?? 0,
    actionCount: actionCounts.find((c) => c.meetingId === m.id)?.n ?? 0,
    updateCount: updates.find((c) => c.meetingId === m.id)?.n ?? 0,
    blockerCount: updates.find((c) => c.meetingId === m.id)?.blocked ?? 0,
    participants: parts
      .filter((p) => p.meetingId === m.id && p.joined && p.role !== "observer")
      .map((p) => ({ name: p.u.name, color: p.u.color, avatarUrl: mediaUrl(p.u.avatarMediaId) })),
  }));
}
export type MeetingListItem = Awaited<ReturnType<typeof teamMeetings>>[number];

export async function teamTemplates(orgId: string, teamId: string, meetingType: string) {
  return db
    .select()
    .from(schema.templates)
    .where(
      and(
        isNull(schema.templates.deletedAt),
        eq(schema.templates.meetingType, meetingType),
        or(eq(schema.templates.teamId, teamId), and(eq(schema.templates.orgId, orgId), isNull(schema.templates.teamId)), and(eq(schema.templates.orgId, orgId), eq(schema.templates.sharedWithOtherTeams, true))),
      ),
    )
    .orderBy(asc(schema.templates.name));
}

export async function teamDecks(orgId: string, teamId: string) {
  return db
    .select()
    .from(schema.estimationDecks)
    .where(and(isNull(schema.estimationDecks.deletedAt), or(eq(schema.estimationDecks.teamId, teamId), and(eq(schema.estimationDecks.orgId, orgId), isNull(schema.estimationDecks.teamId)))))
    .orderBy(asc(schema.estimationDecks.name));
}

export async function orgUsers(orgId: string) {
  const rows = await db
    .select({ ou: schema.orgUsers, u: schema.users })
    .from(schema.orgUsers)
    .innerJoin(schema.users, eq(schema.users.id, schema.orgUsers.userId))
    .where(eq(schema.orgUsers.orgId, orgId))
    .orderBy(asc(schema.users.name));
  const teamRows = await db
    .select({ userId: schema.members.userId, teamId: schema.teams.id, teamName: schema.teams.name, roles: schema.members.roles })
    .from(schema.members)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.members.teamId))
    .where(and(eq(schema.teams.orgId, orgId), isNull(schema.teams.deletedAt)));
  return rows.map(({ ou, u }) => ({
    orgUserId: ou.id,
    userId: u.id,
    name: u.name,
    email: u.email,
    color: u.color,
    avatarUrl: mediaUrl(u.avatarMediaId),
    roles: ou.roles,
    active: ou.active,
    invited: !ou.joinedAt,
    lastSeenAt: (ou.lastSeenAt ?? u.lastSeenAt)?.toISOString() ?? null,
    teams: teamRows.filter((t) => t.userId === u.id).map((t) => ({ id: t.teamId, name: t.teamName, admin: t.roles.includes("admin") })),
  }));
}

export async function pendingRequests(orgId: string, teamId?: string) {
  const rows = await db
    .select({ r: schema.userRequests, u: schema.users })
    .from(schema.userRequests)
    .innerJoin(schema.users, eq(schema.users.id, schema.userRequests.userId))
    .where(and(eq(schema.userRequests.orgId, orgId), eq(schema.userRequests.status, "pending"), teamId ? eq(schema.userRequests.teamId, teamId) : undefined))
    .orderBy(desc(schema.userRequests.createdAt));
  const teamIds = rows.map((r) => r.r.teamId).filter(Boolean) as string[];
  const teams = teamIds.length ? await db.select({ id: schema.teams.id, name: schema.teams.name }).from(schema.teams).where(inArray(schema.teams.id, teamIds)) : [];
  return rows.map(({ r, u }) => ({
    id: r.id,
    kind: r.kind,
    teamId: r.teamId,
    teamName: teams.find((t) => t.id === r.teamId)?.name ?? (r.data?.name as string | undefined) ?? null,
    userName: u.name,
    userEmail: u.email,
    userId: u.id,
    data: r.data,
    createdAt: r.createdAt.toISOString(),
  }));
}
