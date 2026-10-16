import "server-only";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "../auth";
import { appUrl } from "../auth";
import { assertTeamAccess, HttpError } from "../access";
import { BUILTIN_DECKS, DEFAULT_OPTIONS, DEFAULT_STEPS, MEETING_TYPE_LABEL } from "@/lib/constants";
import { findBuiltinTemplate } from "@/lib/templates";
import type { Anonymity, DeckCard, MeetingOptions, MeetingStep, MeetingType, SeriesSchedule, Topic } from "@/lib/types";
import { addParticipant, START_PERMISSION, type Meeting } from "./context";
import { layout, sendMail, escapeHtml } from "../email";
import { logActivity } from "../activity";
import { emitTeamChange } from "../realtime";
import { dispatchEvent } from "../integrations/events";

export type CreateMeetingInput = {
  type: MeetingType;
  title?: string;
  date?: string;
  templateId?: string | null;
  topics?: Topic[];
  steps?: MeetingStep[];
  options?: MeetingOptions;
  anonymity?: Anonymity;
  context?: string;
  contextMediaId?: string | null;
  healthModelId?: string | null;
  deckId?: string | null;
  invite?: boolean;
  closePrevious?: boolean;
  schedule?: SeriesSchedule | null;
  seriesId?: string | null;
  isDemo?: boolean;
};

export function mergeSteps(type: MeetingType, provided?: MeetingStep[]): MeetingStep[] {
  const defaults = DEFAULT_STEPS[type];
  if (!provided?.length) return structuredClone(defaults);
  return defaults.map((d) => {
    const p = provided.find((s) => s.key === d.key);
    return p ? { key: d.key, enabled: p.enabled, options: { ...(d.options ?? {}), ...(p.options ?? {}) } } : structuredClone(d);
  });
}

export async function resolveTopics(teamId: string, templateId: string | null | undefined, fallbackType: MeetingType): Promise<{ topics: Topic[]; name: string | null; key: string | null; options?: MeetingOptions; stepOptions?: Record<string, unknown> }> {
  if (templateId) {
    const builtin = findBuiltinTemplate(templateId);
    if (builtin) return { topics: structuredClone(builtin.body.topics), name: builtin.name, key: builtin.id, options: builtin.body.options, stepOptions: builtin.body.stepOptions };
    const [custom] = await db.select().from(schema.templates).where(eq(schema.templates.id, templateId)).limit(1);
    if (custom) return { topics: structuredClone(custom.body.topics), name: custom.name, key: custom.id, options: custom.body.options, stepOptions: custom.body.stepOptions };
  }
  if (fallbackType === "standup") {
    const t = findBuiltinTemplate("builtin:daily-standup")!;
    return { topics: structuredClone(t.body.topics), name: t.name, key: t.id };
  }
  if (fallbackType === "retrospective") {
    const t = findBuiltinTemplate("builtin:agile-retrospective")!;
    return { topics: structuredClone(t.body.topics), name: t.name, key: t.id };
  }
  return { topics: [], name: null, key: null };
}

export async function resolveDeck(teamId: string, deckId?: string | null): Promise<{ id?: string; name: string; cards: DeckCard[] }> {
  if (deckId) {
    const builtin = BUILTIN_DECKS.find((d) => d.id === deckId);
    if (builtin) return structuredClone(builtin);
    const [custom] = await db.select().from(schema.estimationDecks).where(eq(schema.estimationDecks.id, deckId)).limit(1);
    if (custom) return { id: custom.id, name: custom.name, cards: custom.cards };
  }
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  if (team?.defaultDeckId && team.defaultDeckId !== deckId) return resolveDeck(teamId, team.defaultDeckId);
  return structuredClone(BUILTIN_DECKS[0]);
}

export function todayIn(timezone?: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function createMeeting(user: CurrentUser, teamId: string, input: CreateMeetingInput): Promise<Meeting> {
  const access = await assertTeamAccess(user, teamId, input.isDemo ? undefined : START_PERMISSION[input.type]);
  const team = access.team;
  if (team.archivedAt) throw new HttpError(400, "This team is archived");

  const tpl = await resolveTopics(teamId, input.templateId, input.type);
  const topics = (input.topics?.length ? input.topics : tpl.topics).map((t, i) => ({ ...t, id: t.id || `t${i + 1}` }));
  const steps = mergeSteps(input.type, input.steps);
  if (tpl.stepOptions && !input.steps?.length) {
    for (const s of steps) {
      const extra = tpl.stepOptions[`${s.key}Step`] as { enabled?: boolean } | undefined;
      if (extra && typeof extra.enabled === "boolean") s.enabled = extra.enabled;
    }
  }
  const options: MeetingOptions = { ...DEFAULT_OPTIONS, ...(tpl.options ?? {}), ...(input.options ?? {}) };
  const firstEnabled = Math.max(0, steps.findIndex((s) => s.enabled));
  const welcome = steps.find((s) => s.key === "welcome" && s.enabled);
  const share = steps.find((s) => s.key === "share" && s.enabled);
  const checkInQ = welcome?.options?.checkInQuestion as string | null | undefined;
  const checkOutQ = share?.options?.checkOutQuestion as string | null | undefined;

  if (input.type === "healthCheck" && !input.healthModelId) throw new HttpError(400, "Choose a health model");

  let seriesId = input.seriesId ?? null;
  if (!seriesId && !input.isDemo && (input.type === "standup" || (input.schedule && input.schedule.recurrence))) {
    const [series] = await db
      .insert(schema.meetingSeries)
      .values({
        teamId,
        type: input.type,
        title: input.title?.trim() || (input.type === "standup" ? "Daily Standup" : ""),
        body: {
          templateId: input.templateId ?? null,
          topics,
          steps,
          options,
          anonymity: input.anonymity ?? "names",
          healthModelId: input.healthModelId ?? null,
          deckId: input.deckId ?? null,
          context: input.context ?? "",
        },
        schedule: input.schedule ?? null,
        active: true,
        lastOccurrence: input.date ?? todayIn(user.timezone),
        createdById: user.id,
      })
      .returning();
    seriesId = series.id;
  }

  if (input.closePrevious) {
    await db
      .update(schema.meetings)
      .set({ status: "closed", closedAt: new Date() })
      .where(and(eq(schema.meetings.teamId, teamId), eq(schema.meetings.type, input.type), eq(schema.meetings.status, "open"), isNull(schema.meetings.deletedAt)));
  }

  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      teamId,
      seriesId,
      type: input.type,
      title: input.title?.trim() ?? "",
      date: input.date ?? todayIn(user.timezone),
      anonymity: input.anonymity ?? "names",
      stepIndex: firstEnabled,
      steps,
      options,
      topics,
      context: input.context ?? "",
      contextMediaId: input.contextMediaId ?? null,
      templateKey: tpl.key,
      templateName: tpl.name,
      healthModelId: input.healthModelId ?? null,
      deck: input.type === "estimation" ? await resolveDeck(teamId, input.deckId) : null,
      checkIn: checkInQ ? { question: checkInQ, revealed: false } : null,
      checkOut: checkOutQ ? { question: checkOutQ, revealed: false } : null,
      icebreaker: { mode: "game", gameKey: null },
      isDemo: !!input.isDemo,
      createdById: user.id,
      startedAt: new Date(),
    })
    .returning();

  await addParticipant(meeting, user.id, "facilitator", { facilitating: input.type !== "standup" || !!input.isDemo });
  if (input.isDemo) return meeting;
  const memberRows = await db
    .select({ m: schema.members, u: schema.users })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(and(eq(schema.members.teamId, teamId), ne(schema.members.userId, user.id)));
  for (const { m } of memberRows) {
    const role = m.roles.includes("admin") || m.roles.includes("member") ? "participant" : "observer";
    await addParticipant(meeting, m.userId, role, { invited: true });
  }

  await db.update(schema.teams).set({ lastActivityAt: new Date() }).where(eq(schema.teams.id, teamId));
  if (input.invite) await inviteTeamToMeeting(user, meeting, team.name);
  await logActivity({ orgId: team.orgId, teamId, userId: user.id, action: `${input.type}.create`, entityType: "meeting", entityId: meeting.id });
  emitTeamChange(teamId);
  void dispatchEvent(teamId, "meeting.created", { meetingId: meeting.id, type: meeting.type, title: meeting.title, url: appUrl(`/m/${meeting.id}`) });
  return meeting;
}

export async function inviteTeamToMeeting(user: CurrentUser, meeting: Meeting, teamName: string) {
  const rows = await db
    .select({ u: schema.users })
    .from(schema.participants)
    .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
    .where(and(eq(schema.participants.meetingId, meeting.id), ne(schema.participants.userId, user.id)));
  const label = MEETING_TYPE_LABEL[meeting.type as MeetingType];
  const link = appUrl(`/m/${meeting.id}`);
  for (const { u } of rows) {
    if (!u.email || u.isGuest) continue;
    if (u.notificationPreferences?.["meeting.invite"] === false) continue;
    await sendMail({
      to: u.email,
      subject: `${user.name} invited you to a ${label.toLowerCase()} with ${teamName}`,
      html: layout(
        `Join the ${label.toLowerCase()}`,
        `<p>${escapeHtml(user.name)} started <strong>${escapeHtml(meeting.title || label)}</strong> for ${escapeHtml(teamName)}.</p>`,
        { label: `Open ${label.toLowerCase()}`, href: link },
      ),
    });
  }
}
