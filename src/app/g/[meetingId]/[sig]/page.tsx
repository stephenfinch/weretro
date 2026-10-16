import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/brand";
import { getCurrentUser } from "@/server/auth";
import { verifyGuestSignature } from "@/server/guest";
import { loadMeeting } from "@/server/meetings/context";
import { GuestJoinForm } from "./guest-form";
import { MEETING_TYPE_LABEL } from "@/lib/constants";
import type { MeetingType } from "@/lib/types";

export const metadata = { title: "Join meeting" };

export default async function GuestPage({ params }: PageProps<"/g/[meetingId]/[sig]">) {
  const { meetingId, sig } = await params;
  if (!verifyGuestSignature(meetingId, sig)) notFound();
  const row = await loadMeeting(meetingId);
  if (!row) notFound();
  const user = await getCurrentUser();
  if (user) redirect(`/g/${meetingId}/${sig}/join`);
  const label = MEETING_TYPE_LABEL[row.meeting.type as MeetingType].toLowerCase();
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold">Join the {label}</h1>
          <p className="text-sm text-muted-foreground">
            {row.team.name} invited you to <strong>{row.meeting.title || row.meeting.templateName || label}</strong>. Enter a name to join as a guest.
          </p>
        </div>
        <GuestJoinForm meetingId={meetingId} sig={sig} />
        <p className="text-center text-xs text-muted-foreground">
          Already have an account? <a className="text-primary hover:underline" href={`/login?next=/g/${meetingId}/${sig}/join`}>Sign in</a>
        </p>
      </div>
    </div>
  );
}
