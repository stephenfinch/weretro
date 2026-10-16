"use server";

import { redirect } from "next/navigation";
import { createSession, createUser } from "@/server/auth";
import { verifyGuestSignature } from "@/server/guest";
import { addParticipant, loadMeeting } from "@/server/meetings/context";
import { bumpVersion } from "@/server/realtime";

export async function joinAsGuest(meetingId: string, sig: string, _: { error?: string } | undefined, form: FormData) {
  if (!verifyGuestSignature(meetingId, sig)) return { error: "This link is invalid" };
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Please enter your name" };
  const row = await loadMeeting(meetingId);
  if (!row) return { error: "This meeting no longer exists" };
  if (row.org.settings?.allowGuests === false) return { error: "Guests aren't allowed in this organization" };
  const user = await createUser({ name, isGuest: true });
  await createSession(user.id);
  await addParticipant(row.meeting, user.id, "guest");
  await bumpVersion(meetingId);
  redirect(`/m/${meetingId}`);
}
