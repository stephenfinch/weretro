import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "../auth";
import { getTeamAccess, HttpError, type TeamAccess } from "../access";
import { ALIAS_ADJECTIVES, ALIAS_ANIMALS, AVATAR_COLORS } from "@/lib/constants";
import type { MeetingType, TeamPermissionKey } from "@/lib/types";

export type Meeting = typeof schema.meetings.$inferSelect;
export type Participant = typeof schema.participants.$inferSelect;

export type MeetingContext = {
  meeting: Meeting;
  team: typeof schema.teams.$inferSelect;
  org: typeof schema.organizations.$inferSelect;
  participant: Participant | null;
  teamAccess: TeamAccess | null;
  viewer: CurrentUser;
};

export const START_PERMISSION: Record<MeetingType, TeamPermissionKey> = {
  retrospective: "startRetrospectives",
  standup: "startStandups",
  healthCheck: "startHealthChecks",
  estimation: "startEstimations",
};

export function randomAlias(taken: Set<string>) {
  for (let i = 0; i < 50; i++) {
    const a = `${ALIAS_ADJECTIVES[Math.floor(Math.random() * ALIAS_ADJECTIVES.length)]} ${ALIAS_ANIMALS[Math.floor(Math.random() * ALIAS_ANIMALS.length)]}`;
    if (!taken.has(a)) return a;
  }
  return `Participant ${Math.floor(Math.random() * 1000)}`;
}

export function canFacilitateMeeting(ctx: Pick<MeetingContext, "meeting" | "participant" | "teamAccess">) {
  const { meeting, participant, teamAccess } = ctx;
  if (participant && (participant.role === "facilitator" || participant.role === "facilitatorOnly")) return true;
  if (!teamAccess) return false;
  if (teamAccess.isAdmin) return true;
  if (teamAccess.can(START_PERMISSION[meeting.type as MeetingType])) return true;
  if (meeting.options?.anyMemberCanFacilitate && teamAccess.isMember) return true;
  return false;
}

export async function loadMeeting(meetingId: string) {
  const rows = await db
    .select({ meeting: schema.meetings, team: schema.teams, org: schema.organizations })
    .from(schema.meetings)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.meetings.teamId))
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.teams.orgId))
    .where(and(eq(schema.meetings.id, meetingId), isNull(schema.meetings.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadMeetingContext(meetingId: string, viewer: CurrentUser, opts: { autoJoin?: boolean } = {}): Promise<MeetingContext> {
  const row = await loadMeeting(meetingId);
  if (!row) throw new HttpError(404, "Meeting not found");
  const { meeting, team, org } = row;
  const teamAccess = viewer.isGuest ? null : await getTeamAccess(viewer, team.id);
  let [participant] = await db
    .select()
    .from(schema.participants)
    .where(and(eq(schema.participants.meetingId, meeting.id), eq(schema.participants.userId, viewer.id)))
    .limit(1);
  if (!participant && !teamAccess) throw new HttpError(403, "You don't have access to this meeting");
  if (!participant && teamAccess && opts.autoJoin && !teamAccess.team.archivedAt) {
    participant = await addParticipant(meeting, viewer.id, teamAccess.roles.includes("observer") && !teamAccess.isMember ? "observer" : teamAccess.isViewer ? "observer" : "participant");
  }
  if (participant && !participant.joinedAt && opts.autoJoin) {
    await db.update(schema.participants).set({ joinedAt: new Date() }).where(eq(schema.participants.id, participant.id));
    participant = { ...participant, joinedAt: new Date() };
  }
  return { meeting, team, org, participant: participant ?? null, teamAccess, viewer };
}

export async function addParticipant(meeting: Meeting, userId: string, role: string, opts: { invited?: boolean; facilitating?: boolean } = {}) {
  const existing = await db
    .select({ alias: schema.participants.alias })
    .from(schema.participants)
    .where(eq(schema.participants.meetingId, meeting.id));
  const alias = randomAlias(new Set(existing.map((e) => e.alias ?? "")));
  const [p] = await db
    .insert(schema.participants)
    .values({
      meetingId: meeting.id,
      userId,
      role,
      alias,
      aliasColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      isFacilitating: !!opts.facilitating,
      invitedAt: opts.invited ? new Date() : null,
      joinedAt: opts.invited ? null : new Date(),
      lastSeenAt: opts.invited ? null : new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (p) return p;
  const [again] = await db
    .select()
    .from(schema.participants)
    .where(and(eq(schema.participants.meetingId, meeting.id), eq(schema.participants.userId, userId)))
    .limit(1);
  return again;
}
