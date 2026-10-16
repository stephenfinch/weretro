import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "../auth";
import { escapeHtml, layout, sendMail } from "../email";
import { dispatchEvent } from "../integrations/events";
import { teamPrefs, wantsNotification } from "../notifications";
import { teamWants } from "@/lib/team-notifications";
import { MEETING_TYPE_LABEL } from "@/lib/constants";
import type { MeetingType } from "@/lib/types";

export async function onMeetingClosed(meetingId: string) {
  const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1);
  if (!m) return;
  await db.update(schema.participants).set({ isFacilitating: false }).where(and(eq(schema.participants.meetingId, meetingId), eq(schema.participants.role, "participant")));
  void dispatchEvent(m.teamId, "meeting.closed", { meetingId, type: m.type, title: m.title, url: appUrl(`/m/${meetingId}`), reportUrl: appUrl(`/m/${meetingId}/report`) });
  if (m.isDemo) return;
  void (async () => {
    if (!(await hasContent(m))) return; // skip empty meetings
    await autoSummary(m).catch((e) => console.error("automatic AI summary failed", e));
    await emailSummary(meetingId);
  })().catch((e) => console.error("summary email failed", e));
}

/** Did anyone contribute anything? Empty meetings get no summary. */
async function hasContent(m: typeof schema.meetings.$inferSelect) {
  const tables = [schema.ideas, schema.healthRatings, schema.standupUpdates, schema.estimationVotes, schema.actionItems] as const;
  for (const t of tables) {
    const [row] = await db.select({ id: t.id }).from(t).where(eq(t.meetingId, m.id)).limit(1);
    if (row) return true;
  }
  return false;
}

async function autoSummary(m: typeof schema.meetings.$inferSelect) {
  const feature = m.type === "retrospective" ? "autoRetroSummary" : m.type === "healthCheck" ? "autoHealthSummary" : null;
  if (!feature || m.aiSummary || !m.createdById) return;
  const [org] = await db
    .select({ settings: schema.organizations.settings })
    .from(schema.teams)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.teams.orgId))
    .where(eq(schema.teams.id, m.teamId))
    .limit(1);
  const { aiFeature } = await import("../ai");
  if (!org || !aiFeature(org, feature)) return;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, m.createdById)).limit(1);
  if (!user) return;
  const { loadMeetingContext } = await import("./context");
  const { summarizeMeeting } = await import("../ai-features");
  await summarizeMeeting(await loadMeetingContext(m.id, user), user);
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
  const [fresh] = await db.select({ aiSummary: schema.meetings.aiSummary }).from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1);
  const summary = fresh?.aiSummary ? `<p><strong>Summary</strong></p><p>${escapeHtml(fresh.aiSummary).replace(/\n/g, "<br>")}</p>` : "";
  const body = summary + `<p>The ${escapeHtml(label.toLowerCase())} <strong>${escapeHtml(m.title || m.date)}</strong> for ${escapeHtml(team?.name ?? "your team")} has closed.</p>
${list.length ? `<p><strong>Actions</strong></p><ul>${list.map((a) => `<li>${escapeHtml(a.title)}</li>`).join("")}</ul>` : "<p>No actions were added.</p>"}`;
  let emails: string[] = recipients ?? [];
  if (!recipients) {
    const rows = await db
      .select({ u: schema.users })
      .from(schema.participants)
      .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
      .where(eq(schema.participants.meetingId, meetingId));
    const prefs = await teamPrefs(m.teamId);
    emails = rows
      .filter((r) => r.u.email && !r.u.isGuest && wantsNotification(r.u.notificationPreferences, "meeting.summary") && teamWants(prefs.get(r.u.id), `summary.${m.type}`))
      .map((r) => r.u.email!);
  }
  for (const to of emails) {
    await sendMail({
      to,
      subject: `${label} summary: ${m.title || m.date}`,
      html: layout(`${label} summary`, body, { label: "View full report", href: appUrl(`/m/${meetingId}/report`) }),
    });
  }
}
