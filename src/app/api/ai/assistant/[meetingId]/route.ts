import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { askAssistant, loadConversation, resetConversation, transcript } from "@/server/assistant";
import { loadMeetingContext } from "@/server/meetings/context";
import { aiEnabledFor } from "@/server/ai";
import { HttpError } from "@/server/access";
import { jsonError, unauthorized } from "@/server/http";

export const maxDuration = 300;

async function guard(meetingId: string) {
  const user = await getCurrentUser();
  if (!user || user.isGuest) throw new HttpError(401, "Not signed in");
  const ctx = await loadMeetingContext(meetingId, user);
  if (!aiEnabledFor(ctx.org)) throw new HttpError(503, "The AI assistant isn't available on this account");
  return user;
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/ai/assistant/[meetingId]">) {
  try {
    const { meetingId } = await ctx.params;
    const user = await guard(meetingId);
    return NextResponse.json({ messages: transcript(await loadConversation(user.id, meetingId)) });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) return unauthorized();
    return jsonError(e);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/ai/assistant/[meetingId]">) {
  try {
    const { meetingId } = await ctx.params;
    const user = await guard(meetingId);
    const { message } = (await req.json()) as { message: string };
    return NextResponse.json({ messages: await askAssistant(meetingId, user, String(message ?? "")) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/ai/assistant/[meetingId]">) {
  try {
    const { meetingId } = await ctx.params;
    const user = await guard(meetingId);
    await resetConversation(user.id, meetingId);
    return NextResponse.json({ messages: [] });
  } catch (e) {
    return jsonError(e);
  }
}
