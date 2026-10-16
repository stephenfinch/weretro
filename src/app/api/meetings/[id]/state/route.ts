import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { loadMeetingContext } from "@/server/meetings/context";
import { buildMeetingState } from "@/server/meetings/state";
import { waitForChange } from "@/server/realtime";
import { jsonError, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest, ctx: RouteContext<"/api/meetings/[id]/state">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const since = Number(req.nextUrl.searchParams.get("v") ?? "-1");
    let mctx = await loadMeetingContext(id, user, { autoJoin: true });
    if (mctx.participant) {
      const last = mctx.participant.lastSeenAt?.getTime() ?? 0;
      if (Date.now() - last > 10_000) {
        await db.update(schema.participants).set({ lastSeenAt: new Date() }).where(eq(schema.participants.id, mctx.participant.id));
      }
    }
    if (since >= 0 && since === mctx.meeting.version) {
      const v = await waitForChange(id, since, 25_000, req.signal);
      if (v === since) return NextResponse.json({ unchanged: true, version: since, serverNow: new Date().toISOString() });
      mctx = await loadMeetingContext(id, user);
    }
    const state = await buildMeetingState(mctx, user);
    return NextResponse.json(state, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return jsonError(e);
  }
}
