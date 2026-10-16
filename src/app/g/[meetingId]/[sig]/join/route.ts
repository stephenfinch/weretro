import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/server/auth";
import { verifyGuestSignature } from "@/server/guest";
import { addParticipant, loadMeeting } from "@/server/meetings/context";
import { bumpVersion } from "@/server/realtime";

export async function GET(req: NextRequest, ctx: RouteContext<"/g/[meetingId]/[sig]/join">) {
  const { meetingId, sig } = await ctx.params;
  if (!verifyGuestSignature(meetingId, sig)) return NextResponse.redirect(new URL("/", req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(`/g/${meetingId}/${sig}`, req.url));
  const row = await loadMeeting(meetingId);
  if (!row) return NextResponse.redirect(new URL("/", req.url));
  const [existing] = await db.select().from(schema.participants).where(and(eq(schema.participants.meetingId, meetingId), eq(schema.participants.userId, user.id))).limit(1);
  if (!existing) {
    const [member] = await db.select().from(schema.members).where(and(eq(schema.members.teamId, row.team.id), eq(schema.members.userId, user.id))).limit(1);
    await addParticipant(row.meeting, user.id, member ? "participant" : "guest");
    await bumpVersion(meetingId);
  }
  return NextResponse.redirect(new URL(`/m/${meetingId}`, req.url));
}
