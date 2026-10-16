import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { canFacilitateMeeting, loadMeetingContext } from "@/server/meetings/context";
import { healthCommentSummaries, suggestActions, suggestGroups, suggestGroupTitle, summarizeMeeting } from "@/server/ai-features";
import { assertAiFeature } from "@/server/ai";
import { bumpVersion } from "@/server/realtime";
import { HttpError } from "@/server/access";
import { jsonError, unauthorized } from "@/server/http";

export const maxDuration = 120;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/ai/meetings/[id]/[action]">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id, action } = await ctx.params;
    const mctx = await loadMeetingContext(id, user);
    const FEATURE = { "suggest-groups": "suggestGroups", "group-title": "groupTitles", "suggest-actions": "suggestActions", summary: "summaries", "health-summaries": "summaries" } as const;
    const feature = FEATURE[action as keyof typeof FEATURE];
    if (!feature) throw new HttpError(404, "Unknown AI action");
    assertAiFeature(mctx.org, feature);
    if (action === "group-title") {
      // anyone who may group ideas can ask for a title
      const body = (await req.json().catch(() => ({}))) as { groupId?: string };
      if (!body.groupId) throw new HttpError(400, "groupId is required");
      const result = await suggestGroupTitle(mctx, body.groupId);
      await bumpVersion(id);
      return NextResponse.json(result);
    }
    if (!canFacilitateMeeting(mctx)) throw new HttpError(403, "Only facilitators can use AI suggestions");
    let result: unknown;
    if (action === "suggest-groups") result = await suggestGroups(mctx);
    else if (action === "suggest-actions") result = await suggestActions(mctx, user);
    else if (action === "summary") result = await summarizeMeeting(mctx, user);
    else result = await healthCommentSummaries(mctx);
    await bumpVersion(id);
    return NextResponse.json(result);
  } catch (e) {
    return jsonError(e);
  }
}
