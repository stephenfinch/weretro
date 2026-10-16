import "server-only";
import { and, desc, eq, inArray, isNull, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "../auth";
import { escapeHtml, layout, sendMail } from "../email";
import { addParticipant, type Meeting } from "./context";
import { mergeSteps, resolveDeck } from "./create";
import { onMeetingClosed } from "./lifecycle";
import { DEFAULT_OPTIONS, MEETING_TYPE_LABEL } from "@/lib/constants";
import type { Anonymity, MeetingOptions, MeetingStep, MeetingType, SeriesSchedule, Topic } from "@/lib/types";
import { teamPrefs, wantsNotification } from "../notifications";
import { teamWants } from "@/lib/team-notifications";
import { emitTeamChange } from "../realtime";

type Series = typeof schema.meetingSeries.$inferSelect;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function zonedParts(date: Date, timezone = "UTC") {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`, weekday: parts.weekday.slice(0, 3).toLowerCase() };
}

export function isScheduledOn(schedule: SeriesSchedule | null, dateStr: string, anchor: string | null) {
  const rec = schedule?.recurrence;
  if (!rec) return false;
  const d = new Date(`${dateStr}T12:00:00Z`);
  const wd = DAYS[d.getUTCDay()];
  if (rec.freq === "day") return (rec.weekdays ?? ["mon", "tue", "wed", "thu", "fri"]).includes(wd);
  if (rec.freq === "week") {
    if (!(rec.weekdays ?? []).includes(wd)) return false;
    if ((rec.interval ?? 1) <= 1 || !anchor) return true;
    const a = new Date(`${anchor}T12:00:00Z`);
    const weeks = Math.floor((d.getTime() - a.getTime()) / (7 * 86400_000));
    return weeks % rec.interval === 0;
  }
  if (rec.freq === "month") {
    if (d.getUTCDate() !== (rec.dayOfMonth ?? 1)) return false;
    if ((rec.interval ?? 1) <= 1 || !anchor) return true;
    const a = new Date(`${anchor}T12:00:00Z`);
    const months = (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth();
    return months % rec.interval === 0;
  }
  return false;
}

export async function createMeetingFromSeries(series: Series, date: string): Promise<Meeting> {
  const body = series.body as { topics?: Topic[]; steps?: MeetingStep[]; options?: MeetingOptions; anonymity?: Anonymity; healthModelId?: string | null; deckId?: string | null; context?: string; templateId?: string | null };
  const type = series.type as MeetingType;
  const steps = mergeSteps(type, body.steps);
  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      teamId: series.teamId,
      seriesId: series.id,
      type,
      title: series.title,
      date,
      anonymity: body.anonymity ?? "names",
      stepIndex: Math.max(0, steps.findIndex((s) => s.enabled)),
      steps,
      options: { ...DEFAULT_OPTIONS, ...(body.options ?? {}) },
      topics: body.topics ?? [],
      context: body.context ?? "",
      healthModelId: body.healthModelId ?? null,
      deck: type === "estimation" ? await resolveDeck(series.teamId, body.deckId) : null,
      templateKey: body.templateId ?? null,
      icebreaker: { mode: "game", gameKey: null },
      createdById: series.createdById,
      startedAt: new Date(),
    })
    .returning();
  const memberRows = await db.select().from(schema.members).where(eq(schema.members.teamId, series.teamId));
  for (const m of memberRows) {
    const role = m.userId === series.createdById ? "facilitator" : m.roles.includes("admin") || m.roles.includes("member") ? "participant" : "observer";
    await addParticipant(meeting, m.userId, role, { invited: true });
  }
  await db.update(schema.meetingSeries).set({ lastOccurrence: date }).where(eq(schema.meetingSeries.id, series.id));
  emitTeamChange(series.teamId);
  return meeting;
}

/** Find the meeting for "today" in a series, creating it if the series allows. */
export async function ensureCurrentMeeting(seriesId: string, now = new Date()) {
  const [series] = await db.select().from(schema.meetingSeries).where(and(eq(schema.meetingSeries.id, seriesId), isNull(schema.meetingSeries.deletedAt))).limit(1);
  if (!series) return null;
  const tz = series.schedule?.timezone || "UTC";
  const today = zonedParts(now, tz).date;
  const [existing] = await db
    .select()
    .from(schema.meetings)
    .where(and(eq(schema.meetings.seriesId, seriesId), isNull(schema.meetings.deletedAt), lte(schema.meetings.date, today)))
    .orderBy(desc(schema.meetings.date), desc(schema.meetings.createdAt))
    .limit(1);
  if (existing?.date === today) return existing;
  if (!series.active || series.canceledDates.includes(today)) return existing ?? null;
  const scheduled = !series.schedule?.recurrence || isScheduledOn(series.schedule, today, series.lastOccurrence);
  if (!scheduled) return existing ?? null;
  if (series.type !== "standup" && (series.schedule?.opens ?? "anytime") === "afterPrevious" && existing?.status === "open") return existing;
  if (series.type === "standup" && existing?.status === "open") {
    await db.update(schema.meetings).set({ status: "closed", closedAt: new Date() }).where(eq(schema.meetings.id, existing.id));
  }
  return createMeetingFromSeries(series, today);
}

async function onceKey(key: string) {
  const rows = await db.insert(schema.notificationsSent).values({ key }).onConflictDoNothing().returning();
  return rows.length > 0;
}

/** Cron entry point: create scheduled meetings, send invites/reminders, close meetings, remind about actions. */
export async function runScheduler(now = new Date()) {
  const log: string[] = [];
  const seriesList = await db.select().from(schema.meetingSeries).where(and(eq(schema.meetingSeries.active, true), isNull(schema.meetingSeries.deletedAt)));
  for (const s of seriesList) {
    const sched = s.schedule;
    if (!sched?.recurrence) continue;
    const tz = sched.timezone || "UTC";
    const { date, time } = zonedParts(now, tz);
    if (!isScheduledOn(sched, date, s.lastOccurrence) || s.canceledDates.includes(date)) continue;
    const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, s.teamId)).limit(1);
    if (!team || team.archivedAt || team.deletedAt) continue;
    // 1. Open & invite
    if (time >= (sched.time ?? "09:00")) {
      const meeting = await ensureCurrentMeeting(s.id, now);
      if (meeting && meeting.date === date && (await onceKey(`invite:${meeting.id}`))) {
        const label = MEETING_TYPE_LABEL[s.type as MeetingType];
        const users = await db
          .select({ u: schema.users })
          .from(schema.participants)
          .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
          .where(and(eq(schema.participants.meetingId, meeting.id), ne(schema.participants.role, "observer")));
        const prefs = await teamPrefs(team.id);
        for (const { u } of users) {
          if (!u.email || !wantsNotification(u.notificationPreferences, s.type === "standup" ? "standup.reminder" : "meeting.invite")) continue;
          if (!teamWants(prefs.get(u.id), `open.${s.type}`)) continue;
          await sendMail({
            to: u.email,
            subject: `${s.title || label} is open for ${team.name}`,
            html: layout(`${s.title || label}`, `<p>Today's ${escapeHtml(label.toLowerCase())} for <strong>${escapeHtml(team.name)}</strong> is ready.</p>`, { label: s.type === "standup" ? "Post your update" : `Open ${label.toLowerCase()}`, href: appUrl(`/m/${meeting.id}`) }),
          });
        }
        log.push(`opened ${meeting.id}`);
      }
    }
    // 2. Reminders
    if (sched.reminders?.enabled && time >= (sched.reminders.time ?? "11:00")) {
      const [meeting] = await db.select().from(schema.meetings).where(and(eq(schema.meetings.seriesId, s.id), eq(schema.meetings.date, date), eq(schema.meetings.status, "open"), isNull(schema.meetings.deletedAt))).limit(1);
      if (meeting && (await onceKey(`remind:${meeting.id}`))) {
        const pending = await db
          .select({ u: schema.users, p: schema.participants })
          .from(schema.participants)
          .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
          .where(and(eq(schema.participants.meetingId, meeting.id), inArray(schema.participants.role, ["participant", "facilitator"])));
        const stepKey = s.type === "standup" ? "standup" : s.type === "healthCheck" ? "healthSurvey" : "brainstorm";
        const prefs = await teamPrefs(team.id);
        for (const { u, p } of pending) {
          if (p.finishedSteps.includes(stepKey) || !u.email || !wantsNotification(u.notificationPreferences, "standup.reminder")) continue;
          if (!teamWants(prefs.get(u.id), `reminder.${s.type}`)) continue;
          await sendMail({
            to: u.email,
            subject: `Reminder: ${s.title || MEETING_TYPE_LABEL[s.type as MeetingType]} is waiting on you`,
            html: layout("Friendly reminder", `<p>${escapeHtml(team.name)} is still waiting for your input.</p>`, { label: "Open", href: appUrl(`/m/${meeting.id}`) }),
          });
        }
        log.push(`reminded ${meeting.id}`);
      }
    }
    // 3. Close
    if (sched.close?.enabled && time >= (sched.close.time ?? "17:00")) {
      const open = await db.select().from(schema.meetings).where(and(eq(schema.meetings.seriesId, s.id), eq(schema.meetings.date, date), eq(schema.meetings.status, "open"), isNull(schema.meetings.deletedAt)));
      for (const m of open) {
        const shareIdx = m.steps.findIndex((x) => x.key === "share" && x.enabled);
        await db.update(schema.meetings).set({ status: "closed", closedAt: new Date(), ...(shareIdx >= 0 ? { stepIndex: shareIdx } : {}), version: sql`${schema.meetings.version} + 1` }).where(eq(schema.meetings.id, m.id));
        await onMeetingClosed(m.id);
        log.push(`closed ${m.id}`);
      }
    }
  }
  log.push(...(await sendActionReminders(now)));
  return log;
}

/** Email members about actions due today or overdue, once per action per day. */
export async function sendActionReminders(now = new Date()) {
  const log: string[] = [];
  const today = now.toISOString().slice(0, 10);
  const due = await db
    .select({ a: schema.actionItems, team: schema.teams })
    .from(schema.actionItems)
    .innerJoin(schema.teams, eq(schema.teams.id, schema.actionItems.teamId))
    .where(and(eq(schema.actionItems.kind, "action"), eq(schema.actionItems.status, "accepted"), isNull(schema.actionItems.deletedAt), lte(schema.actionItems.dueDate, today), isNull(schema.teams.deletedAt)));
  const byTeam = new Map<string, typeof due>();
  for (const row of due) byTeam.set(row.team.id, [...(byTeam.get(row.team.id) ?? []), row]);
  for (const [teamId, rows] of byTeam) {
    const members = await db.select({ m: schema.members, u: schema.users }).from(schema.members).innerJoin(schema.users, eq(schema.users.id, schema.members.userId)).where(eq(schema.members.teamId, teamId));
    for (const { m, u } of members) {
      if (!u.email || m.reminders === "none" || !wantsNotification(u.notificationPreferences, "actionReminders") || !teamWants(m.notificationPreferences, "actionReminders")) continue;
      const mine = rows.filter((r) => m.reminders === "all" || r.a.assigneeIds.includes(u.id));
      if (!mine.length || !(await onceKey(`actions:${u.id}:${teamId}:${today}`))) continue;
      await sendMail({
        to: u.email,
        subject: `${mine.length} ${mine.length === 1 ? "action is" : "actions are"} due — ${rows[0].team.name}`,
        html: layout("Actions due", `<ul>${mine.map((r) => `<li>${escapeHtml(r.a.title)} <em>(due ${r.a.dueDate})</em></li>`).join("")}</ul>`, { label: "Open team actions", href: appUrl(`/t/${teamId}`) }),
      });
      log.push(`action reminder ${u.id}`);
    }
  }
  return log;
}
