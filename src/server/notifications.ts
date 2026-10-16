import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl, type CurrentUser } from "./auth";
import { escapeHtml, layout, sendMail } from "./email";
import { KUDOS_TYPES } from "@/lib/constants";
import { teamWants } from "@/lib/team-notifications";

export const NOTIFICATION_EVENTS: { key: string; category: string; label: string; default: boolean }[] = [
  { key: "mentions", category: "Mentions & kudos", label: "When someone @mentions you", default: true },
  { key: "kudos", category: "Mentions & kudos", label: "When someone gives you kudos", default: true },
  { key: "actionAssigned", category: "Actions", label: "When an action is assigned to you", default: true },
  { key: "actionReminders", category: "Actions", label: "Reminders for actions that are due", default: true },
  { key: "meeting.invite", category: "Meetings", label: "Invitations to meetings", default: true },
  { key: "meeting.summary", category: "Meetings", label: "Meeting summaries when a meeting closes", default: true },
  { key: "standup.reminder", category: "Meetings", label: "Standup reminders", default: true },
  { key: "team.added", category: "Teams", label: "When you're added to a team", default: true },
  { key: "requests", category: "Admin", label: "Team and access requests", default: true },
];

/** Each member's per-team notification switches, keyed by user id. */
export async function teamPrefs(teamId: string) {
  const rows = await db.select({ userId: schema.members.userId, prefs: schema.members.notificationPreferences }).from(schema.members).where(eq(schema.members.teamId, teamId));
  return new Map(rows.map((r) => [r.userId, r.prefs as Record<string, unknown>]));
}

export function wantsNotification(prefs: Record<string, unknown> | null | undefined, key: string) {
  const v = prefs?.[key];
  if (v === false || v === "off") return false;
  if (v === true || v === "on") return true;
  return NOTIFICATION_EVENTS.find((e) => e.key === key)?.default ?? true;
}

export async function notifyMentions(input: { teamId: string; meetingId?: string; fromUser: CurrentUser; text: string; refId: string; explicitUserIds?: string[] }) {
  const members = await db
    .select({ u: schema.users })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.teamId, input.teamId));
  const lower = input.text.toLowerCase();
  const targets = new Set(input.explicitUserIds ?? []);
  for (const { u } of members) {
    if (u.id === input.fromUser.id) continue;
    const first = u.name.split(" ")[0]?.toLowerCase();
    if (lower.includes(`@${u.name.toLowerCase()}`) || (first && new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower))) targets.add(u.id);
  }
  if (!targets.size) return;
  const prefs = await teamPrefs(input.teamId);
  const link = appUrl(input.meetingId ? `/m/${input.meetingId}` : `/t/${input.teamId}`);
  for (const { u } of members) {
    if (!targets.has(u.id) || !u.email || !wantsNotification(u.notificationPreferences, "mentions") || !teamWants(prefs.get(u.id), "mentions")) continue;
    await sendMail({
      to: u.email,
      subject: `${input.fromUser.name} mentioned you`,
      html: layout(`${input.fromUser.name} mentioned you`, `<blockquote style="border-left:3px solid #ddd;margin:0;padding-left:12px">${escapeHtml(input.text)}</blockquote>`, { label: "Open", href: link }),
    });
  }
}

export async function notifyKudos(input: { fromUser: CurrentUser; toUserId: string; teamId: string; type: string; message: string }) {
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, input.toUserId)).limit(1);
  if (!u?.email || !wantsNotification(u.notificationPreferences, "kudos")) return;
  if (!teamWants((await teamPrefs(input.teamId)).get(u.id), "kudos")) return;
  const k = KUDOS_TYPES.find((t) => t.key === input.type);
  await sendMail({
    to: u.email,
    subject: `${input.fromUser.name} gave you kudos ${k?.emoji ?? ""}`,
    html: layout(`${k?.label ?? "Kudos!"}`, `<p>${escapeHtml(input.fromUser.name)} gave you kudos.</p>${input.message ? `<p><em>${escapeHtml(input.message)}</em></p>` : ""}`, {
      label: "View team",
      href: appUrl(`/t/${input.teamId}`),
    }),
  });
}

export async function notifyAssigned(teamId: string, actionTitle: string, userIds: string[], byUser: CurrentUser) {
  if (!userIds.length) return;
  const users = await db.select().from(schema.users).where(inArray(schema.users.id, userIds));
  for (const u of users) {
    if (u.id === byUser.id || !u.email || !wantsNotification(u.notificationPreferences, "actionAssigned")) continue;
    await sendMail({
      to: u.email,
      subject: `New action assigned: ${actionTitle.slice(0, 80)}`,
      html: layout("An action was assigned to you", `<p>${escapeHtml(byUser.name)} assigned you: <strong>${escapeHtml(actionTitle)}</strong></p>`, {
        label: "Open team actions",
        href: appUrl(`/t/${teamId}`),
      }),
    });
  }
}

export async function teamAdminEmails(teamId: string) {
  const rows = await db
    .select({ u: schema.users, m: schema.members })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(and(eq(schema.members.teamId, teamId)));
  return rows.filter((r) => r.m.roles.includes("admin") && r.u.email).map((r) => r.u);
}
