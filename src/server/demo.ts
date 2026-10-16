import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "./auth";
import { HttpError } from "./access";
import { addParticipant, type MeetingContext } from "./meetings/context";
import { createMeeting } from "./meetings/create";
import { bumpVersion } from "./realtime";
import { ensureBuiltinHealthModels } from "./health-models";
import type { MeetingType } from "@/lib/types";

/**
 * Demo meetings are private sandboxes (meetings.is_demo = true) filled with robot
 * participants. Each time the facilitator's browser polls the meeting, `demoTick`
 * lets the robots take one small step suited to the current meeting step, so the
 * demo feels like a live session without any background worker.
 */

const ROBOTS = [
  { name: "Ada Robot", color: "#0EA5E9" },
  { name: "Bolt Robot", color: "#F97316" },
  { name: "Cog Robot", color: "#22C55E" },
  { name: "Dot Robot", color: "#A855F7" },
  { name: "Echo Robot", color: "#EC4899" },
  { name: "Flux Robot", color: "#EAB308" },
];

const COMMENTS = ["Completely agree with this", "Good call", "Can we pair on this?", "I'd like to discuss this further", "+1, same here", "Let's add this to the parking lot", "Nice work!"];
const EMOJIS = ["👍", "❤️", "🎉", "😀", "👏", "💡"];

const IDEAS: Record<string, string[]> = {
  positive: [
    "Pairing on the tricky bugs saved us days",
    "Release went out without a hitch",
    "Daily syncs were short and useful",
    "Great support from the design team",
    "New test suite caught two regressions early",
    "Demo to stakeholders landed really well",
  ],
  negative: [
    "Too many meetings broke up focus time",
    "Requirements changed late in the sprint",
    "Flaky CI slowed every merge",
    "Code reviews waited a long time",
    "We took on too much work again",
    "Unclear ownership of the on-call rota",
  ],
  neutral: [
    "Try a no-meeting afternoon each week",
    "Rotate who runs the standup",
    "Write down decisions in one place",
    "Spike the new deployment tooling",
    "Ask product for a mid-sprint check-in",
    "Celebrate small wins more often",
  ],
};

const STANDUP: Record<string, string[]> = {
  yesterday: [
    "Finished the login form validation",
    "Reviewed two pull requests",
    "Paired on the reporting bug and found the root cause",
    "Updated the API docs for the new endpoints",
    "Rolled the feature flag out to half of our accounts",
    "Cleaned up warnings from the linter",
    "Merged the payments refactor",
  ],
  today: [
    "Start on the export feature",
    "Write tests for the billing module",
    "Fix the flaky integration test",
    "Sync with design on the new dashboard",
    "Draft the plan for offline support",
    "Look into the slow upload endpoint",
  ],
  blockers: ["Waiting on access to the staging database", "Need a decision on the pricing copy", "Need a review on the migration PR"],
};

const ESTIMATION_ITEMS = [
  { title: "Add password reset by email", description: "Users can request a reset link and choose a new password." },
  { title: "Export meeting summary as PDF", description: "One-click export from the report page." },
  { title: "Show unread notifications badge", description: "Badge in the header with the unread count." },
  { title: "Bulk-archive old teams", description: "Admins can select several teams and archive them at once." },
];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
const shuffled = <T,>(list: T[]) => [...list].sort(() => Math.random() - 0.5);

async function robotUsers() {
  const existing = await db.select().from(schema.users).where(sql`${schema.users.options}->>'robot' = 'true'`);
  const out = [...existing];
  for (const r of ROBOTS) {
    if (out.some((u) => u.name === r.name)) continue;
    const [u] = await db.insert(schema.users).values({ name: r.name, color: r.color, isGuest: true, options: { robot: true } }).returning();
    out.push(u);
  }
  return out.filter((u) => ROBOTS.some((r) => r.name === u.name));
}

export async function createDemoMeeting(user: CurrentUser, teamId: string, type: MeetingType) {
  let healthModelId: string | null = null;
  if (type === "healthCheck") {
    await ensureBuiltinHealthModels();
    const [team] = await db.select({ d: schema.teams.defaultHealthModelId }).from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
    healthModelId = team?.d ?? "builtin-team-radar";
    const [exists] = await db.select({ id: schema.healthModels.id }).from(schema.healthModels).where(eq(schema.healthModels.id, healthModelId)).limit(1);
    if (!exists) {
      const [first] = await db.select({ id: schema.healthModels.id }).from(schema.healthModels).where(sql`${schema.healthModels.builtinKey} is not null`).limit(1);
      if (!first) throw new HttpError(500, "No health models available");
      healthModelId = first.id;
    }
  }
  const meeting = await createMeeting(user, teamId, {
    type,
    isDemo: true,
    title: `Demo ${type === "healthCheck" ? "health check" : type}`,
    healthModelId,
    deckId: type === "estimation" ? "scrum" : null,
  });
  for (const r of await robotUsers()) await addParticipant(meeting, r.id, "participant");
  if (type === "standup") {
    const [ctxRow] = await db
      .select({ team: schema.teams, org: schema.organizations })
      .from(schema.teams)
      .innerJoin(schema.organizations, eq(schema.organizations.id, schema.teams.orgId))
      .where(eq(schema.teams.id, teamId))
      .limit(1);
    const { applyOp } = await import("./meetings/ops");
    const robots = await db
      .select({ p: schema.participants, u: schema.users })
      .from(schema.participants)
      .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
      .where(and(eq(schema.participants.meetingId, meeting.id), sql`${schema.users.options}->>'robot' = 'true'`));
    // All but one robot have already posted, so the facilitator sees a lively feed straight away.
    for (const r of robots.slice(0, -1)) {
      const rctx = { meeting, team: ctxRow.team, org: ctxRow.org, participant: r.p, teamAccess: null, viewer: r.u };
      for (const [i, t] of meeting.topics.entries()) {
        const pool = i === 0 ? STANDUP.yesterday : i === 1 ? STANDUP.today : STANDUP.blockers;
        const n = i >= 2 ? (Math.random() < 0.4 ? 1 : 0) : 1 + Math.floor(Math.random() * 2);
        for (const text of shuffled(pool).slice(0, n)) await applyOp(rctx, { type: "standup.add", topicId: t.id, text }).catch(() => {});
      }
      await applyOp(rctx, { type: "step.finish", step: "standup" }).catch(() => {});
    }
  }
  if (type === "estimation") {
    let pos = 0;
    for (const it of ESTIMATION_ITEMS) {
      await db.insert(schema.estimationItems).values({ meetingId: meeting.id, teamId, title: it.title, description: it.description, position: pos++ });
    }
  }
  return meeting;
}

const lastTick = new Map<string, number>();

export async function demoTick(ctx: MeetingContext) {
  const m = ctx.meeting;
  if (!m.isDemo || m.status !== "open") return;
  const now = Date.now();
  if (now - (lastTick.get(m.id) ?? 0) < 2500) return;
  lastTick.set(m.id, now);

  const robots = await db
    .select({ p: schema.participants, u: schema.users })
    .from(schema.participants)
    .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
    .where(and(eq(schema.participants.meetingId, m.id), sql`${schema.users.options}->>'robot' = 'true'`));
  if (!robots.length) return;
  const { applyOp } = await import("./meetings/ops");
  const step = m.steps[m.stepIndex]?.key;
  let changed = false;
  const act = async (r: (typeof robots)[number], op: Record<string, unknown>) => {
    try {
      await applyOp({ meeting: m, team: ctx.team, org: ctx.org, participant: r.p, teamAccess: null, viewer: r.u }, op as never);
      changed = true;
    } catch {
      // robots ignore rejected moves (limits reached, step changed, ...)
    }
  };

  // Robots mark themselves present.
  await db.update(schema.participants).set({ lastSeenAt: new Date(), joinedAt: sql`coalesce(${schema.participants.joinedAt}, now())` }).where(inArray(schema.participants.id, robots.map((r) => r.p.id)));

  if (m.checkIn?.question && !m.checkIn.revealed) {
    const answered = await db.select({ pid: schema.checkResponses.participantId }).from(schema.checkResponses).where(and(eq(schema.checkResponses.meetingId, m.id), eq(schema.checkResponses.kind, "in")));
    for (const r of robots) if (!answered.some((a) => a.pid === r.p.id)) await act(r, { type: "check.respond", kind: "in", value: 2 + Math.floor(Math.random() * 4) });
  }

  switch (step) {
    case "brainstorm": {
      const ideas = await db.select({ pid: schema.ideas.participantId }).from(schema.ideas).where(eq(schema.ideas.meetingId, m.id));
      for (const r of robots) {
        const mine = ideas.filter((i) => i.pid === r.p.id).length;
        if (mine >= 4) {
          if (!r.p.finishedSteps.includes("brainstorm")) await act(r, { type: "step.finish", step: "brainstorm" });
          continue;
        }
        if (!m.topics.length || Math.random() < 0.4) continue;
        const topic = pick(m.topics);
        const idx = m.topics.indexOf(topic);
        const pool = idx === 0 ? IDEAS.positive : idx === 1 ? IDEAS.negative : IDEAS.neutral;
        await act(r, { type: "idea.add", topicId: topic.id, text: pick(pool) });
      }
      break;
    }
    case "vote": {
      const [ideas, groups] = await Promise.all([
        db.select({ id: schema.ideas.id, groupId: schema.ideas.groupId }).from(schema.ideas).where(eq(schema.ideas.meetingId, m.id)),
        db.select({ id: schema.ideaGroups.id }).from(schema.ideaGroups).where(eq(schema.ideaGroups.meetingId, m.id)),
      ]);
      const targets = [...groups.map((g) => g.id), ...ideas.filter((i) => !i.groupId).map((i) => i.id)];
      const maxVotes = (m.steps.find((x) => x.key === "vote")?.options?.maxVotes as number | null | undefined) ?? 5;
      const cast = await db.select({ pid: schema.votes.participantId, count: schema.votes.count }).from(schema.votes).where(eq(schema.votes.meetingId, m.id));
      for (const r of robots) {
        const used = cast.filter((v) => v.pid === r.p.id).reduce((a, v) => a + v.count, 0);
        if (targets.length && used < (maxVotes ?? 3) && Math.random() < 0.7) await act(r, { type: "vote.cast", targetId: pick(targets) });
        else if (used >= (maxVotes ?? 3) && !r.p.finishedSteps.includes("vote")) await act(r, { type: "step.finish", step: "vote" });
      }
      break;
    }
    case "healthSurvey": {
      if (!m.healthModelId) break;
      const dims = await db.select({ id: schema.healthDimensions.id }).from(schema.healthDimensions).where(eq(schema.healthDimensions.modelId, m.healthModelId));
      const [model] = await db.select().from(schema.healthModels).where(eq(schema.healthModels.id, m.healthModelId)).limit(1);
      const rated = await db.select({ pid: schema.healthRatings.participantId }).from(schema.healthRatings).where(eq(schema.healthRatings.meetingId, m.id));
      const r = robots.find((x) => !rated.some((y) => y.pid === x.p.id));
      if (r && model) {
        const bias = Math.random();
        for (const d of dims) {
          const span = model.maxRating - model.minRating;
          const v = Math.round(model.minRating + Math.min(1, Math.max(0, bias + (Math.random() - 0.5) * 0.6)) * span);
          await act(r, { type: "health.rate", dimensionId: d.id, value: v, comment: Math.random() < 0.15 ? pick(IDEAS.neutral) : undefined });
        }
        await act(r, { type: "step.finish", step: "healthSurvey" });
      }
      break;
    }
    case "estimate": {
      const items = await db.select().from(schema.estimationItems).where(eq(schema.estimationItems.meetingId, m.id));
      const target = items.find((i) => i.id === m.presenting?.targetId) ?? items.find((i) => !i.finalEstimate);
      if (!target || target.phase === "review") break;
      const votes = await db.select({ pid: schema.estimationVotes.participantId }).from(schema.estimationVotes).where(eq(schema.estimationVotes.itemId, target.id));
      const r = robots.find((x) => !votes.some((v) => v.pid === x.p.id));
      const cards = (m.deck?.cards ?? []).filter((c) => c.value !== null && c.value !== undefined);
      if (r && cards.length) {
        const center = Math.floor(cards.length / 3);
        const c = cards[Math.max(0, Math.min(cards.length - 1, center + Math.floor(Math.random() * 3) - 1))];
        await act(r, { type: "estimation.vote", itemId: target.id, value: c.label });
      }
      break;
    }
    case "standup": {
      const ups = await db.select({ id: schema.standupUpdates.id, pid: schema.standupUpdates.participantId, topicId: schema.standupUpdates.topicId }).from(schema.standupUpdates).where(eq(schema.standupUpdates.meetingId, m.id));
      const r = robots.find((x) => !x.p.finishedSteps.includes("standup"));
      if (r) {
        const topic = m.topics.find((t) => !ups.some((u) => u.pid === r.p.id && u.topicId === t.id));
        if (topic) {
          const idx = m.topics.indexOf(topic);
          await act(r, { type: "standup.add", topicId: topic.id, text: pick(idx === 0 ? STANDUP.yesterday : idx === 1 ? STANDUP.today : STANDUP.blockers) });
        } else await act(r, { type: "step.finish", step: "standup" });
      }
      // Robots react to and comment on updates, including yours.
      if (ups.length && Math.random() < 0.5) {
        const target = pick(ups);
        const who = pick(robots.filter((x) => x.p.id !== target.pid));
        if (who) {
          if (Math.random() < 0.7) await act(who, { type: "reaction.toggle", targetId: target.id, emoji: pick(EMOJIS) });
          else await act(who, { type: "comment.add", targetType: "update", targetId: target.id, text: pick(COMMENTS) });
        }
      }
      break;
    }
    case "discuss": {
      const target = m.presenting?.targetId;
      if (target && Math.random() < 0.3) {
        if (Math.random() < 0.7) await act(pick(robots), { type: "reaction.toggle", targetId: target, emoji: pick(EMOJIS) });
        else {
          const [group] = await db.select({ id: schema.ideaGroups.id }).from(schema.ideaGroups).where(eq(schema.ideaGroups.id, target)).limit(1);
          await act(pick(robots), { type: "comment.add", targetType: group ? "group" : "idea", targetId: target, text: pick(COMMENTS) });
        }
      }
      break;
    }
  }
  if (changed) await bumpVersion(m.id);
}
