import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { loadMeetingContext } from "@/server/meetings/context";
import { applyOp, type Op } from "@/server/meetings/ops";
import { buildMeetingState } from "@/server/meetings/state";
import { bumpVersion } from "@/server/realtime";
import { jsonError, unauthorized } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/meetings/[id]/ops">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const body = (await req.json()) as { op?: Op; ops?: Op[]; returnState?: boolean };
    const ops = body.ops ?? (body.op ? [body.op] : []);
    let mctx = await loadMeetingContext(id, user, { autoJoin: true });
    const results: unknown[] = [];
    for (const op of ops) {
      results.push(await applyOp(mctx, op));
      mctx = await loadMeetingContext(id, user);
    }
    const quiet = ops.length > 0 && ops.every((o) => o.type === "typing");
    if (ops.length) await bumpVersion(id);
    if (quiet || body.returnState === false) return NextResponse.json({ results });
    const fresh = await loadMeetingContext(id, user);
    const state = await buildMeetingState(fresh, user);
    return NextResponse.json({ results, state });
  } catch (e) {
    return jsonError(e);
  }
}
