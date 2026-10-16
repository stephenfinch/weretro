"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { assertTeamAccess, HttpError } from "@/server/access";
import { createMeeting, type CreateMeetingInput } from "@/server/meetings/create";
import { loadMeetingContext, canFacilitateMeeting } from "@/server/meetings/context";
import { bumpVersion, emitTeamChange } from "@/server/realtime";
import type { MeetingOptions, MeetingStep, SeriesSchedule, Topic } from "@/lib/types";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

export async function createMeetingAction(teamId: string, input: CreateMeetingInput) {
  return wrap(async () => {
    const user = await requireUser();
    const m = await createMeeting(user, teamId, input);
    revalidatePath(`/t/${teamId}`, "layout");
    return { id: m.id };
  });
}

/** Save "Customize meeting" changes. scope=series also updates the recurring series template. */
export async function customizeMeetingAction(
  meetingId: string,
  input: { title?: string; date?: string; context?: string; anonymity?: string; topics?: Topic[]; steps?: MeetingStep[]; options?: MeetingOptions; schedule?: SeriesSchedule | null; deckId?: string | null },
  scope: "meeting" | "series" = "meeting",
) {
  return wrap(async () => {
    const user = await requireUser();
    const ctx = await loadMeetingContext(meetingId, user);
    if (!canFacilitateMeeting(ctx)) throw new HttpError(403, "Only facilitators can customize this meeting");
    const { applyOp } = await import("@/server/meetings/ops");
    if (ctx.meeting.status === "open" || scope === "meeting") {
      const patch: Record<string, unknown> = { type: "meeting.update", title: input.title, date: input.date, context: input.context, topics: input.topics, steps: input.steps, options: input.options, anonymity: input.anonymity };
      if (input.deckId !== undefined && ctx.meeting.type === "estimation") {
        const { resolveDeck } = await import("@/server/meetings/create");
        patch.deck = await resolveDeck(ctx.team.id, input.deckId);
      }
      await applyOp(ctx, patch as { type: string });
    }
    if (scope === "series" || input.schedule !== undefined) {
      let seriesId = ctx.meeting.seriesId;
      if (!seriesId && input.schedule?.recurrence) {
        const [s] = await db.insert(schema.meetingSeries).values({ teamId: ctx.team.id, type: ctx.meeting.type, title: input.title ?? ctx.meeting.title, createdById: user.id, lastOccurrence: ctx.meeting.date }).returning();
        seriesId = s.id;
        await db.update(schema.meetings).set({ seriesId }).where(eq(schema.meetings.id, meetingId));
      }
      if (seriesId) {
        const [series] = await db.select().from(schema.meetingSeries).where(eq(schema.meetingSeries.id, seriesId)).limit(1);
        await db
          .update(schema.meetingSeries)
          .set({
            title: input.title ?? series.title,
            schedule: input.schedule !== undefined ? input.schedule : series.schedule,
            body: { ...series.body, topics: input.topics ?? series.body.topics, steps: input.steps ?? series.body.steps, options: input.options ?? series.body.options, anonymity: input.anonymity ?? series.body.anonymity, deckId: input.deckId ?? series.body.deckId },
          })
          .where(eq(schema.meetingSeries.id, seriesId));
      }
    }
    await bumpVersion(meetingId);
    emitTeamChange(ctx.team.id);
  });
}

export async function deleteMeetingAction(meetingId: string, opts: { cancelRecurrence?: boolean } = {}) {
  return wrap(async () => {
    const user = await requireUser();
    const ctx = await loadMeetingContext(meetingId, user);
    if (!canFacilitateMeeting(ctx)) throw new HttpError(403, "Only facilitators can delete this meeting");
    await db.update(schema.meetings).set({ deletedAt: new Date() }).where(eq(schema.meetings.id, meetingId));
    if (ctx.meeting.seriesId) {
      const [s] = await db.select().from(schema.meetingSeries).where(eq(schema.meetingSeries.id, ctx.meeting.seriesId)).limit(1);
      if (s) await db.update(schema.meetingSeries).set({ canceledDates: [...s.canceledDates, ctx.meeting.date], ...(opts.cancelRecurrence ? { active: false } : {}) }).where(eq(schema.meetingSeries.id, s.id));
    }
    await bumpVersion(meetingId);
    revalidatePath(`/t/${ctx.team.id}`, "layout");
    return { teamId: ctx.team.id };
  });
}

export async function deleteSeriesAction(teamId: string, seriesId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await assertTeamAccess(user, teamId);
    if (!access.isAdmin) throw new HttpError(403, "Only admins can delete a series");
    const now = new Date();
    await db.update(schema.meetingSeries).set({ deletedAt: now }).where(and(eq(schema.meetingSeries.id, seriesId), eq(schema.meetingSeries.teamId, teamId)));
    await db.update(schema.meetings).set({ deletedAt: now }).where(eq(schema.meetings.seriesId, seriesId));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function setSeriesActive(teamId: string, seriesId: string, active: boolean) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId, "startStandups");
    await db.update(schema.meetingSeries).set({ active }).where(and(eq(schema.meetingSeries.id, seriesId), eq(schema.meetingSeries.teamId, teamId)));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}
