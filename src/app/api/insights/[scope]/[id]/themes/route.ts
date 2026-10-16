import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { getOrgAccess, getTeamAccess, HttpError } from "@/server/access";
import { listOrgTeams } from "@/server/orgs";
import { analyzeIdeas } from "@/server/ai-features";
import { aiEnabledFor } from "@/server/ai";
import { jsonError, unauthorized } from "@/server/http";

export const maxDuration = 120;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/insights/[scope]/[id]/themes">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { scope, id } = await ctx.params;
    let teamIds: string[] = [];
    let org;
    if (scope === "team") {
      const a = await getTeamAccess(user, id);
      if (!a) throw new HttpError(404, "Not found");
      org = a.org;
      teamIds = a.team.isProgram ? [id, ...a.team.memberTeamIds] : [id];
    } else {
      const a = await getOrgAccess(user, id);
      if (!a?.canInsights) throw new HttpError(403, "Not allowed");
      org = a.org;
      teamIds = (await listOrgTeams(a.org.id, true)).map((t) => t.id);
    }
    if (!aiEnabledFor(org)) throw new HttpError(503, "AI is turned off");
    const meetings = teamIds.length
      ? await db.select({ id: schema.meetings.id }).from(schema.meetings).where(and(inArray(schema.meetings.teamId, teamIds), isNull(schema.meetings.deletedAt), eq(schema.meetings.type, "retrospective"))).orderBy(desc(schema.meetings.date)).limit(30)
      : [];
    const ideas = meetings.length ? await db.select({ id: schema.ideas.id, text: schema.ideas.text }).from(schema.ideas).where(inArray(schema.ideas.meetingId, meetings.map((m) => m.id))) : [];
    const r = await analyzeIdeas(ideas);
    return NextResponse.json({ themes: r.themes.map((t) => ({ theme: t.theme, count: t.ideaIds.length })).sort((a, b) => b.count - a.count) });
  } catch (e) {
    return jsonError(e);
  }
}
