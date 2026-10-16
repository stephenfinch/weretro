"use server";

import { requireUser } from "@/server/auth";
import { HttpError } from "@/server/access";
import { addParticipant, canFacilitateMeeting, loadMeetingContext } from "@/server/meetings/context";
import { inviteToTeam } from "@/server/orgs";
import { findUserByEmail } from "@/server/auth";
import { bumpVersion } from "@/server/realtime";
import { guestSignature } from "@/server/guest";
import { inviteTeamToMeeting } from "@/server/meetings/create";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export async function getGuestLink(meetingId: string): Promise<Result<string>> {
  try {
    const user = await requireUser();
    const ctx = await loadMeetingContext(meetingId, user);
    if (!canFacilitateMeeting(ctx)) throw new HttpError(403, "Only facilitators can create guest links");
    if (ctx.org.settings?.allowGuests === false) throw new HttpError(403, "Guest participants are disabled for this organization");
    return { ok: true, data: `/g/${meetingId}/${guestSignature(meetingId)}` };
  } catch (e) {
    return { ok: false, error: e instanceof HttpError ? e.message : "Something went wrong" };
  }
}

export async function inviteToMeeting(meetingId: string, emails: string[]): Promise<Result> {
  try {
    const user = await requireUser();
    const ctx = await loadMeetingContext(meetingId, user);
    if (!canFacilitateMeeting(ctx)) throw new HttpError(403, "Only facilitators can invite participants");
    if (emails.length) await inviteToTeam(user, ctx.team.id, emails, "member");
    for (const e of emails) {
      const u = await findUserByEmail(e);
      if (u) await addParticipant(ctx.meeting, u.id, "participant", { invited: true });
    }
    if (!emails.length) await inviteTeamToMeeting(user, ctx.meeting, ctx.team.name);
    await bumpVersion(meetingId);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof HttpError ? e.message : "Something went wrong" };
  }
}
