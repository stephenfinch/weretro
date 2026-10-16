import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { getOrgAccess } from "@/server/access";
import { listOrgTeams } from "@/server/orgs";
import { userTeams } from "@/server/queries";
import { unauthorized } from "@/server/http";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const orgId = req.nextUrl.searchParams.get("org") ?? "";
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const access = await getOrgAccess(user, orgId);
  if (!access) return NextResponse.json({ results: [] });
  const teams = access.isAdmin || access.org.settings?.teamTransparency ? await listOrgTeams(access.org.id, true) : (await userTeams(user.id, access.org.id)).map((t) => t.team);
  const teamIds = teams.map((t) => t.id);
  if (!teamIds.length) return NextResponse.json({ results: [] });
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "";
  const pattern = `%${q.replace(/[%_]/g, "")}%`;
  const ideas = await db
    .select({ id: schema.ideas.id, text: schema.ideas.text, meetingId: schema.meetings.id, title: schema.meetings.title, date: schema.meetings.date, teamId: schema.meetings.teamId, type: schema.meetings.type })
    .from(schema.ideas)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.ideas.meetingId))
    .where(and(inArray(schema.meetings.teamId, teamIds), eq(schema.meetings.status, "closed"), isNull(schema.meetings.deletedAt), ilike(schema.ideas.text, pattern)))
    .orderBy(desc(schema.meetings.date))
    .limit(25);
  const actions = await db
    .select()
    .from(schema.actionItems)
    .where(and(inArray(schema.actionItems.teamId, teamIds), isNull(schema.actionItems.deletedAt), ilike(schema.actionItems.title, pattern)))
    .orderBy(desc(schema.actionItems.createdAt))
    .limit(25);
  const comments = await db
    .select({ id: schema.comments.id, text: schema.comments.text, meetingId: schema.comments.meetingId, teamId: schema.comments.teamId, createdAt: schema.comments.createdAt })
    .from(schema.comments)
    .innerJoin(schema.meetings, eq(schema.meetings.id, schema.comments.meetingId))
    .where(and(inArray(schema.comments.teamId, teamIds), isNull(schema.comments.deletedAt), eq(schema.meetings.status, "closed"), ilike(schema.comments.text, pattern)))
    .orderBy(desc(schema.comments.createdAt))
    .limit(25);
  const updates = await db
    .select({ id: schema.standupUpdates.id, text: schema.standupUpdates.text, meetingId: schema.standupUpdates.meetingId, teamId: schema.standupUpdates.teamId, createdAt: schema.standupUpdates.createdAt })
    .from(schema.standupUpdates)
    .where(and(inArray(schema.standupUpdates.teamId, teamIds), ilike(schema.standupUpdates.text, pattern)))
    .orderBy(desc(schema.standupUpdates.createdAt))
    .limit(15);
  const results = [
    ...actions.map((a) => ({ kind: a.kind === "agreement" ? "Agreement" : a.kind === "parked" ? "Parked item" : "Action", text: a.title, href: a.meetingId ? `/m/${a.meetingId}/report` : `/t/${a.teamId}`, team: teamName(a.teamId), date: a.createdAt.toISOString().slice(0, 10) })),
    ...ideas.map((i) => ({ kind: "Idea", text: i.text, href: `/m/${i.meetingId}/report`, team: teamName(i.teamId), date: i.date })),
    ...comments.map((c) => ({ kind: "Comment", text: c.text, href: `/m/${c.meetingId}/report`, team: teamName(c.teamId), date: c.createdAt.toISOString().slice(0, 10) })),
    ...updates.map((u) => ({ kind: "Standup update", text: u.text, href: `/m/${u.meetingId}`, team: teamName(u.teamId), date: u.createdAt.toISOString().slice(0, 10) })),
  ];
  return NextResponse.json({ results });
}
