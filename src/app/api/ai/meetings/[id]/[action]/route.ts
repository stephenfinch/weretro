import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { canFacilitateMeeting, loadMeetingContext } from "@/server/meetings/context";
import { healthCommentSummaries, suggestActions, suggestGroups, summarizeMeeting } from "@/server/ai-features";
import { aiEnabledFor } from "@/server/ai";
import { bumpVersion } from "@/server/realtime";
import { HttpError } from "@/server/access";
import { jsonError, unauthorized } from "@/server/http";

export const maxDuration = 120;

export async function POST(_req: NextRequest, ctx: RouteContext<"/api/ai/meetings/[id]/[action]">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id, action } = await ctx.params;
    const mctx = await loadMeetingContext(id, user);
    if (!aiEnabledFor(mctx.org)) throw new HttpError(503, "AI features are turned off for this organization");
    if (!canFacilitateMeeting(mctx)) throw new HttpError(403, "Only facilitators can use AI suggestions");
    let result: unknown;
    if (action === "suggest-groups") result = await suggestGroups(mctx);
    else if (action === "suggest-actions") result = await suggestActions(mctx, user);
    else if (action === "summary") result = await summarizeMeeting(mctx, user);
    else if (action === "health-summaries") result = await healthCommentSummaries(mctx);
    else throw new HttpError(404, "Unknown AI action");
    await bumpVersion(id);
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
