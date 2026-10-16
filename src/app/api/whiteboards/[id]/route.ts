import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { loadMeetingContext, canFacilitateMeeting } from "@/server/meetings/context";
import { jsonError, unauthorized } from "@/server/http";
import { HttpError } from "@/server/access";
import { bumpVersion } from "@/server/realtime";

type El = { id: string; version?: number; versionNonce?: number; isDeleted?: boolean };

async function load(id: string) {
  const [w] = await db.select().from(schema.whiteboards).where(and(eq(schema.whiteboards.id, id), isNull(schema.whiteboards.deletedAt))).limit(1);
  if (!w) throw new HttpError(404, "Whiteboard not found");
  return w;
}

export async function GET(req: NextRequest, ctx: RouteContext<"/api/whiteboards/[id]">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const w = await load(id);
    if (w.meetingId) await loadMeetingContext(w.meetingId, user);
    const since = Number(req.nextUrl.searchParams.get("since") ?? "-1");
    if (since === w.sceneVersion) return NextResponse.json({ unchanged: true, sceneVersion: w.sceneVersion });
    return NextResponse.json({ id: w.id, title: w.title, scene: w.scene, sceneVersion: w.sceneVersion, editPermission: w.editPermission, createdById: w.createdById });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/whiteboards/[id]">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const w = await load(id);
    if (w.meetingId) {
      const mctx = await loadMeetingContext(w.meetingId, user);
      if (w.editPermission === "creator" && w.createdById !== user.id && !canFacilitateMeeting(mctx)) throw new HttpError(403, "Only the creator can edit this whiteboard");
      if (!mctx.participant || mctx.participant.role === "observer") throw new HttpError(403, "Observers can't edit whiteboards");
    }
    const body = (await req.json()) as { elements: El[]; files?: Record<string, unknown> };
    if (JSON.stringify(body).length > 4_000_000) throw new HttpError(413, "Whiteboard is too large");
    // element-level merge: keep whichever copy has the higher version
    const merged = new Map<string, El>();
    for (const el of (w.scene.elements as El[]) ?? []) merged.set(el.id, el);
    for (const el of body.elements ?? []) {
      const cur = merged.get(el.id);
      if (!cur || (el.version ?? 0) > (cur.version ?? 0) || ((el.version ?? 0) === (cur.version ?? 0) && (el.versionNonce ?? 0) < (cur.versionNonce ?? 0))) merged.set(el.id, el);
    }
    const scene = { elements: [...merged.values()], files: { ...(w.scene.files ?? {}), ...(body.files ?? {}) } };
    const [row] = await db
      .update(schema.whiteboards)
      .set({ scene, sceneVersion: sql`${schema.whiteboards.sceneVersion} + 1`, updatedAt: new Date() })
      .where(eq(schema.whiteboards.id, id))
      .returning({ sceneVersion: schema.whiteboards.sceneVersion });
    if (w.meetingId) await bumpVersion(w.meetingId);
    return NextResponse.json({ sceneVersion: row.sceneVersion, scene });
  } catch (e) {
    return jsonError(e);
  }
}
