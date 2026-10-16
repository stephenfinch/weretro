import { NextResponse, type NextRequest } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { createDemoMeeting } from "@/server/demo";
import { HttpError } from "@/server/access";
import type { MeetingType } from "@/lib/types";

const TYPES: MeetingType[] = ["retrospective", "standup", "healthCheck", "estimation"];

export async function GET(req: NextRequest, ctx: RouteContext<"/demo/[type]">) {
  const { type } = await ctx.params;
  const teamId = req.nextUrl.searchParams.get("team");
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`, req.url));
  if (!teamId || !TYPES.includes(type as MeetingType)) return NextResponse.redirect(new URL("/home", req.url));
  // tidy up this user's old demo sandboxes
  await db
    .update(schema.meetings)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.meetings.isDemo, true), eq(schema.meetings.createdById, user.id), lt(schema.meetings.createdAt, new Date(Date.now() - 24 * 3600_000))));
  try {
    const m = await createDemoMeeting(user, teamId, type as MeetingType);
    return NextResponse.redirect(new URL(`/m/${m.id}`, req.url));
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : "Couldn't start the demo";
    if (!(e instanceof HttpError)) console.error(e);
    return NextResponse.redirect(new URL(`/t/${teamId}?error=${encodeURIComponent(msg)}`, req.url));
  }
}
