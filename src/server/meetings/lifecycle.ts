import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "../auth";
import { escapeHtml, layout, sendMail } from "../email";
import { dispatchEvent } from "../integrations/events";
import { wantsNotification } from "../notifications";
import { MEETING_TYPE_LABEL } from "@/lib/constants";
import type { MeetingType } from "@/lib/types";

export async function onMeetingClosed(meetingId: string) {
  const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1);
  if (!m) return;
  await db.update(schema.participants).set({ isFacilitating: false }).where(and(eq(schema.participants.meetingId, meetingId), eq(schema.participants.role, "participant")));
  void dispatchEvent(m.teamId, "meeting.closed", { meetingId, type: m.type, title: m.title, url: appUrl(`/m/${meetingId}`), reportUrl: appUrl(`/m/${meetingId}/report`) });
  if (m.isDemo) return;
  void emailSummary(meetingId).catch((e) => console.error("summary email failed", e));
}

export async function emailSummary(meetingId: string, recipients?: string[]) {
  const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1);
  if (!m) return;
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, m.teamId)).limit(1);
  const label = MEETING_TYPE_LABEL[m.type as MeetingType];
  const actions = await db
    .select()
    .from(schema.actionItems)
    .where(and(eq(schema.actionItems.meetingId, meetingId), eq(schema.actionItems.kind, "action")));
  const list = actions.filter((a) => a.status === "accepted" || a.status === "completed");
  const body = `<p>The ${escapeHtml(label.toLowerCase())} <strong>${escapeHtml(m.title || m.date)}</strong> for ${escapeHtml(team?.name ?? "your team")} has closed.</p>
${list.length ? `<p><strong>Actions</strong></p><ul>${list.map((a) => `<li>${escapeHtml(a.title)}</li>`).join("")}</ul>` : "<p>No actions were added.</p>"}`;
  let emails: string[] = recipients ?? [];
  if (!recipients) {
    const rows = await db
      .select({ u: schema.users })
      .from(schema.participants)
      .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
      .where(eq(schema.participants.meetingId, meetingId));
    emails = rows.filter((r) => r.u.email && !r.u.isGuest && wantsNotification(r.u.notificationPreferences, "meeting.summary")).map((r) => r.u.email!);
  }
  for (const to of emails) {
    await sendMail({
      to,
      subject: `${label} summary: ${m.title || m.date}`,
      html: layout(`${label} summary`, body, { label: "View full report", href: appUrl(`/m/${meetingId}/report`) }),
    });
  }
}
