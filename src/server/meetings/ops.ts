import "server-only";
import { and, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "../access";
import { addParticipant, canFacilitateMeeting, type MeetingContext, type Participant } from "./context";
import type {
  Anonymity,
  Attachment,
  DiscussOptions,
  GroupOptions,
  IcebreakerState,
  MeetingOptions,
  MeetingStep,
  TimerState,
  Topic,
  VoteOptions,
} from "@/lib/types";
import { dispatchEvent } from "../integrations/events";
import { appUrl } from "../auth";
import { emitTeamChange } from "../realtime";
import { onMeetingClosed } from "./lifecycle";

export type Op = { type: string; [k: string]: unknown };

const CONTRIBUTOR_ROLES = ["facilitator", "participant", "guest"];

function str(v: unknown, maxLen = 5000, required = false): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (required && !s) throw new HttpError(400, "Text is required");
  return s.slice(0, maxLen);
}
function optStr(v: unknown, maxLen = 5000): string | undefined {
  return typeof v === "string" ? v.trim().slice(0, maxLen) : undefined;
}
function num(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function bool(v: unknown) {
  return v === true || v === "true";
}

function stepOf(ctx: MeetingContext, key: string) {
  return ctx.meeting.steps.find((s) => s.key === key);
}
function currentKey(ctx: MeetingContext) {
  return ctx.meeting.steps[ctx.meeting.stepIndex]?.key;
}

async function ensureFacilitator(ctx: MeetingContext): Promise<Participant> {
  if (!canFacilitateMeeting(ctx)) throw new HttpError(403, "Only facilitators can do that");
  let p = ctx.participant;
  if (!p) {
    p = await addParticipant(ctx.meeting, ctx.viewer.id, "facilitator", { facilitating: true });
  } else if (!p.isFacilitating || (p.role !== "facilitator" && p.role !== "facilitatorOnly")) {
    const role = p.role === "facilitator" || p.role === "facilitatorOnly" ? p.role : p.role === "observer" ? "facilitatorOnly" : "facilitator";
    await db.update(schema.participants).set({ isFacilitating: true, role }).where(eq(schema.participants.id, p.id));
    p = { ...p, isFacilitating: true, role };
  }
  ctx.participant = p;
  return p;
}

function isFacilitating(ctx: MeetingContext) {
  return !!ctx.participant?.isFacilitating && canFacilitateMeeting(ctx);
}

function ensureOpen(ctx: MeetingContext) {
  if (ctx.meeting.status === "closed") throw new HttpError(400, "This meeting is closed");
}

function ensureContributor(ctx: MeetingContext): Participant {
  ensureOpen(ctx);
  const p = ctx.participant;
  if (!p || !CONTRIBUTOR_ROLES.includes(p.role)) throw new HttpError(403, "You are observing this meeting");
  return p;
}

function ensureMember(ctx: MeetingContext): Participant {
  const p = ctx.participant;
  if (!p || p.role === "observer") throw new HttpError(403, "You are observing this meeting");
  return p;
}

function checkPermission(ctx: MeetingContext, perm: DiscussOptions["actionPermission"] | undefined, propose: boolean) {
  if (isFacilitating(ctx)) return;
  const p = perm ?? "participantNoPropose";
  if (p === "facilitatorNoPropose") throw new HttpError(403, "Only facilitators can add these");
  if (p === "facilitatorCanPropose" && !propose) throw new HttpError(403, "You can propose, but only facilitators can add");
  if (p === "participantNoPropose" && propose) return;
}

async function nextPosition(table: typeof schema.ideas | typeof schema.ideaGroups | typeof schema.actionItems | typeof schema.estimationItems | typeof schema.standupUpdates, where: ReturnType<typeof eq> | ReturnType<typeof and>) {
  const [row] = await db.select({ m: max(table.position) }).from(table).where(where);
  return (row?.m ?? 0) + 1;
}

async function cleanupGroup(groupId: string | null) {
  if (!groupId) return;
  const remaining = await db.select({ id: schema.ideas.id }).from(schema.ideas).where(eq(schema.ideas.groupId, groupId));
  if (remaining.length <= 1) {
    await db.update(schema.ideas).set({ groupId: null }).where(eq(schema.ideas.groupId, groupId));
    await db.delete(schema.votes).where(eq(schema.votes.targetId, groupId));
    await db.delete(schema.ideaGroups).where(eq(schema.ideaGroups.id, groupId));
  }
}

async function getIdea(ctx: MeetingContext, id: unknown) {
  const [idea] = await db
    .select()
    .from(schema.ideas)
    .where(and(eq(schema.ideas.id, String(id)), eq(schema.ideas.meetingId, ctx.meeting.id)))
    .limit(1);
  if (!idea) throw new HttpError(404, "Idea not found");
  return idea;
}

async function getGroup(ctx: MeetingContext, id: unknown) {
  const [g] = await db
    .select()
    .from(schema.ideaGroups)
    .where(and(eq(schema.ideaGroups.id, String(id)), eq(schema.ideaGroups.meetingId, ctx.meeting.id)))
    .limit(1);
  if (!g) throw new HttpError(404, "Group not found");
  return g;
}

async function getAction(ctx: MeetingContext, id: unknown) {
  const [a] = await db
    .select()
    .from(schema.actionItems)
    .where(and(eq(schema.actionItems.id, String(id)), eq(schema.actionItems.teamId, ctx.team.id)))
    .limit(1);
  if (!a) throw new HttpError(404, "Item not found");
  return a;
}

function canGroup(ctx: MeetingContext) {
  if (isFacilitating(ctx)) return true;
  const g = (stepOf(ctx, "group")?.options ?? {}) as GroupOptions;
  return (g.permission ?? "participant") === "participant";
}

async function sourceText(ctx: MeetingContext, sourceType: string | undefined, sourceId: string | undefined) {
  if (!sourceType || !sourceId) return null;
  if (sourceType === "idea") return (await getIdea(ctx, sourceId)).text;
  if (sourceType === "group") {
    const g = await getGroup(ctx, sourceId);
    if (g.title) return g.title;
    const ideas = await db.select({ text: schema.ideas.text }).from(schema.ideas).where(eq(schema.ideas.groupId, g.id));
    return ideas.map((i) => i.text).join(" / ");
  }
  if (sourceType === "comment") {
    const [c] = await db.select({ text: schema.comments.text }).from(schema.comments).where(eq(schema.comments.id, sourceId)).limit(1);
    return c?.text ?? null;
  }
  if (sourceType === "dimension") {
    const [d] = await db.select({ name: schema.healthDimensions.name }).from(schema.healthDimensions).where(eq(schema.healthDimensions.id, sourceId)).limit(1);
    return d?.name ?? null;
  }
  if (sourceType === "estimationItem") {
    const [e] = await db.select({ title: schema.estimationItems.title }).from(schema.estimationItems).where(eq(schema.estimationItems.id, sourceId)).limit(1);
    return e?.title ?? null;
  }
  if (sourceType === "update") {
    const [u] = await db.select({ text: schema.standupUpdates.text }).from(schema.standupUpdates).where(eq(schema.standupUpdates.id, sourceId)).limit(1);
    return u?.text ?? null;
  }
  return null;
}

/**
 * Apply a single mutation to a meeting. Returns an optional result payload.
 * The caller is responsible for bumping the meeting version afterwards.
 */
export async function applyOp(ctx: MeetingContext, op: Op): Promise<unknown> {
  const m = ctx.meeting;
  switch (op.type) {
    // ── Presence ──────────────────────────────────────────────────────────
    case "typing": {
      if (ctx.participant) await db.update(schema.participants).set({ typingAt: new Date() }).where(eq(schema.participants.id, ctx.participant.id));
      return;
    }

    // ── Ideas ─────────────────────────────────────────────────────────────
    case "idea.add": {
      const p = ensureContributor(ctx);
      const topicId = str(op.topicId, 64, true);
      if (!m.topics.some((t) => t.id === topicId)) throw new HttpError(400, "Unknown topic");
      const attachments = (Array.isArray(op.attachments) ? op.attachments : []) as Attachment[];
      const text = str(op.text, 2000);
      if (!text && !attachments.length) throw new HttpError(400, "Text is required");
      const anonymous = bool(op.anonymous) && !!m.options.allowAnonymousContributions;
      const [idea] = await db
        .insert(schema.ideas)
        .values({
          meetingId: m.id,
          topicId,
          participantId: p.id,
          text,
          anonymous,
          color: optStr(op.color, 16) ?? null,
          attachments,
          position: await nextPosition(schema.ideas, and(eq(schema.ideas.meetingId, m.id), eq(schema.ideas.topicId, topicId))!),
        })
        .returning();
      await db.update(schema.participants).set({ typingAt: null }).where(eq(schema.participants.id, p.id));
      return { id: idea.id };
    }
    case "idea.update": {
      ensureOpen(ctx);
      const idea = await getIdea(ctx, op.id);
      if (idea.participantId !== ctx.participant?.id && !isFacilitating(ctx)) throw new HttpError(403, "You can only edit your own ideas");
      const patch: Partial<typeof schema.ideas.$inferInsert> = { updatedAt: new Date() };
      if (op.text !== undefined) patch.text = str(op.text, 2000);
      if (op.color !== undefined) patch.color = optStr(op.color, 16) || null;
      if (op.attachments !== undefined) patch.attachments = op.attachments as Attachment[];
      if (op.topicId !== undefined && m.topics.some((t) => t.id === op.topicId)) {
        patch.topicId = String(op.topicId);
        if (idea.groupId) {
          patch.groupId = null;
        }
      }
      if (op.anonymous !== undefined && m.options.allowAnonymousContributions) patch.anonymous = bool(op.anonymous);
      await db.update(schema.ideas).set(patch).where(eq(schema.ideas.id, idea.id));
      if (patch.groupId === null) await cleanupGroup(idea.groupId);
      return;
    }
    case "idea.delete": {
      ensureOpen(ctx);
      const idea = await getIdea(ctx, op.id);
      if (idea.participantId !== ctx.participant?.id && !isFacilitating(ctx)) throw new HttpError(403, "You can only delete your own ideas");
      await deleteIdeas([idea.id]);
      await cleanupGroup(idea.groupId);
      return;
    }
    case "idea.move": {
      ensureOpen(ctx);
      if (!canGroup(ctx)) throw new HttpError(403, "Only the facilitator can group");
      const idea = await getIdea(ctx, op.id);
      let groupId: string | null = op.groupId ? String(op.groupId) : null;
      let topicId = op.topicId ? String(op.topicId) : idea.topicId;
      if (groupId) topicId = (await getGroup(ctx, groupId)).topicId;
      if (!m.topics.some((t) => t.id === topicId)) throw new HttpError(400, "Unknown topic");
      const position = op.position !== undefined ? num(op.position) : idea.position;
      await db.update(schema.ideas).set({ groupId, topicId, position }).where(eq(schema.ideas.id, idea.id));
      if (idea.groupId && idea.groupId !== groupId) {
        await db.delete(schema.votes).where(eq(schema.votes.targetId, idea.id));
        await cleanupGroup(idea.groupId);
      }
      if (groupId && !idea.groupId) await db.delete(schema.votes).where(eq(schema.votes.targetId, idea.id));
      groupId = null;
      return;
    }
    case "idea.combine": {
      ensureOpen(ctx);
      if (!canGroup(ctx)) throw new HttpError(403, "Only the facilitator can group");
      const source = await getIdea(ctx, op.id);
      const target = await getIdea(ctx, op.targetId);
      if (source.id === target.id) return;
      let groupId = target.groupId;
      if (!groupId) {
        const [g] = await db
          .insert(schema.ideaGroups)
          .values({ meetingId: m.id, topicId: target.topicId, title: "", position: target.position })
          .returning();
        groupId = g.id;
        await db.update(schema.ideas).set({ groupId }).where(eq(schema.ideas.id, target.id));
        await db.update(schema.votes).set({ targetId: groupId }).where(eq(schema.votes.targetId, target.id));
      }
      const [g] = await db.select({ topicId: schema.ideaGroups.topicId }).from(schema.ideaGroups).where(eq(schema.ideaGroups.id, groupId));
      const pos = await nextPosition(schema.ideas, eq(schema.ideas.groupId, groupId));
      await db.update(schema.ideas).set({ groupId, topicId: g.topicId, position: pos }).where(eq(schema.ideas.id, source.id));
      await db.delete(schema.votes).where(eq(schema.votes.targetId, source.id));
      if (source.groupId && source.groupId !== groupId) await cleanupGroup(source.groupId);
      return { groupId };
    }
    case "idea.park": {
      ensureOpen(ctx);
      const idea = await getIdea(ctx, op.id);
      const parked = op.parked !== false;
      await db.update(schema.ideas).set({ parkedAt: parked ? new Date() : null }).where(eq(schema.ideas.id, idea.id));
      if (parked) await createActionItem(ctx, { kind: "parked", title: idea.text || "Parked idea", sourceType: "idea", sourceId: idea.id, sourceText: idea.text });
      else await removeParkedFor(ctx, idea.id);
      return;
    }

    // ── Groups ────────────────────────────────────────────────────────────
    case "group.create": {
      ensureOpen(ctx);
      if (!canGroup(ctx)) throw new HttpError(403, "Only the facilitator can group");
      const ids = (Array.isArray(op.ideaIds) ? op.ideaIds : []).map(String);
      const ideas = ids.length ? await db.select().from(schema.ideas).where(and(eq(schema.ideas.meetingId, m.id), inArray(schema.ideas.id, ids))) : [];
      if (ideas.length < 1) throw new HttpError(400, "Select ideas to group");
      const [g] = await db
        .insert(schema.ideaGroups)
        .values({ meetingId: m.id, topicId: ideas[0].topicId, title: str(op.title, 200), position: ideas[0].position, suggested: bool(op.suggested) })
        .returning();
      const oldGroups = new Set(ideas.map((i) => i.groupId).filter(Boolean) as string[]);
      await db.update(schema.ideas).set({ groupId: g.id, topicId: g.topicId }).where(inArray(schema.ideas.id, ideas.map((i) => i.id)));
      await db.delete(schema.votes).where(inArray(schema.votes.targetId, ideas.map((i) => i.id)));
      for (const og of oldGroups) await cleanupGroup(og);
      return { id: g.id };
    }
    case "group.update": {
      ensureOpen(ctx);
      const g = await getGroup(ctx, op.id);
      const patch: Partial<typeof schema.ideaGroups.$inferInsert> = {};
      if (op.title !== undefined) patch.title = str(op.title, 200);
      if (op.position !== undefined) patch.position = num(op.position);
      if (op.topicId !== undefined && m.topics.some((t) => t.id === op.topicId)) {
        patch.topicId = String(op.topicId);
        await db.update(schema.ideas).set({ topicId: patch.topicId }).where(eq(schema.ideas.groupId, g.id));
      }
      if (op.suggested !== undefined) patch.suggested = bool(op.suggested);
      await db.update(schema.ideaGroups).set(patch).where(eq(schema.ideaGroups.id, g.id));
      return;
    }
    case "group.ungroup": {
      ensureOpen(ctx);
      if (!canGroup(ctx)) throw new HttpError(403, "Only the facilitator can group");
      const g = await getGroup(ctx, op.id);
      await db.update(schema.ideas).set({ groupId: null }).where(eq(schema.ideas.groupId, g.id));
      await db.delete(schema.votes).where(eq(schema.votes.targetId, g.id));
      await db.delete(schema.ideaGroups).where(eq(schema.ideaGroups.id, g.id));
      return;
    }
    case "group.delete": {
      ensureOpen(ctx);
      await ensureFacilitator(ctx);
      const g = await getGroup(ctx, op.id);
      const ideas = await db.select({ id: schema.ideas.id }).from(schema.ideas).where(eq(schema.ideas.groupId, g.id));
      await deleteIdeas(ideas.map((i) => i.id));
      await db.delete(schema.votes).where(eq(schema.votes.targetId, g.id));
      await db.delete(schema.ideaGroups).where(eq(schema.ideaGroups.id, g.id));
      return;
    }
    case "group.merge": {
      ensureOpen(ctx);
      if (!canGroup(ctx)) throw new HttpError(403, "Only the facilitator can group");
      const g = await getGroup(ctx, op.id);
      const target = await getGroup(ctx, op.targetId);
      if (g.id === target.id) return;
      await db.update(schema.ideas).set({ groupId: target.id, topicId: target.topicId }).where(eq(schema.ideas.groupId, g.id));
      await db.delete(schema.votes).where(eq(schema.votes.targetId, g.id));
      await db.delete(schema.ideaGroups).where(eq(schema.ideaGroups.id, g.id));
      return;
    }
    case "group.accept": {
      await getGroup(ctx, op.id);
      await db.update(schema.ideaGroups).set({ suggested: false }).where(eq(schema.ideaGroups.id, String(op.id)));
      return;
    }
    case "group.acceptAll": {
      await db.update(schema.ideaGroups).set({ suggested: false }).where(eq(schema.ideaGroups.meetingId, m.id));
      return;
    }
    case "group.rejectAll": {
      const sugg = await db.select().from(schema.ideaGroups).where(and(eq(schema.ideaGroups.meetingId, m.id), eq(schema.ideaGroups.suggested, true)));
      for (const g of sugg) {
        await db.update(schema.ideas).set({ groupId: null }).where(eq(schema.ideas.groupId, g.id));
        await db.delete(schema.ideaGroups).where(eq(schema.ideaGroups.id, g.id));
      }
      return;
    }
    case "group.park": {
      ensureOpen(ctx);
      const g = await getGroup(ctx, op.id);
      const parked = op.parked !== false;
      await db.update(schema.ideaGroups).set({ parkedAt: parked ? new Date() : null }).where(eq(schema.ideaGroups.id, g.id));
      if (parked) await createActionItem(ctx, { kind: "parked", title: (await sourceText(ctx, "group", g.id)) || "Parked group", sourceType: "group", sourceId: g.id });
      else await removeParkedFor(ctx, g.id);
      return;
    }

    // ── Voting ────────────────────────────────────────────────────────────
    case "vote.cast": {
      const p = ensureContributor(ctx);
      const opts = (stepOf(ctx, "vote")?.options ?? {}) as VoteOptions;
      const targetId = str(op.targetId, 64, true);
      const delta = num(op.delta, 1) >= 0 ? 1 : -1;
      const [existing] = await db
        .select()
        .from(schema.votes)
        .where(and(eq(schema.votes.participantId, p.id), eq(schema.votes.targetId, targetId)))
        .limit(1);
      if (delta < 0) {
        if (!existing) return;
        if (existing.count <= 1) await db.delete(schema.votes).where(eq(schema.votes.id, existing.id));
        else await db.update(schema.votes).set({ count: existing.count - 1 }).where(eq(schema.votes.id, existing.id));
        return;
      }
      const mine = await db.select().from(schema.votes).where(and(eq(schema.votes.participantId, p.id), eq(schema.votes.meetingId, m.id)));
      const used = mine.reduce((a, v) => a + v.count, 0);
      const unlimited = opts.maxVotes === null || (opts.facilitatorUnlimited && isFacilitating(ctx));
      const maxVotes = opts.maxVotes === undefined ? 5 : opts.maxVotes;
      if (!unlimited && maxVotes !== null && used >= maxVotes) throw new HttpError(400, "No votes remaining");
      if (opts.itemLimit && (existing?.count ?? 0) >= opts.itemLimit) throw new HttpError(400, `Max ${opts.itemLimit} votes per item`);
      // validate target exists & topic limit
      const [idea] = await db.select().from(schema.ideas).where(and(eq(schema.ideas.id, targetId), eq(schema.ideas.meetingId, m.id))).limit(1);
      const [group] = idea ? [] : await db.select().from(schema.ideaGroups).where(and(eq(schema.ideaGroups.id, targetId), eq(schema.ideaGroups.meetingId, m.id))).limit(1);
      if (!idea && !group) throw new HttpError(404, "Nothing to vote on");
      if (opts.topicLimit) {
        const topicId = idea?.topicId ?? group!.topicId;
        const targets = [
          ...(await db.select({ id: schema.ideas.id }).from(schema.ideas).where(and(eq(schema.ideas.meetingId, m.id), eq(schema.ideas.topicId, topicId)))).map((r) => r.id),
          ...(await db.select({ id: schema.ideaGroups.id }).from(schema.ideaGroups).where(and(eq(schema.ideaGroups.meetingId, m.id), eq(schema.ideaGroups.topicId, topicId)))).map((r) => r.id),
        ];
        const inTopic = mine.filter((v) => targets.includes(v.targetId)).reduce((a, v) => a + v.count, 0);
        if (inTopic >= opts.topicLimit) throw new HttpError(400, `Max ${opts.topicLimit} votes per topic`);
      }
      if (existing) await db.update(schema.votes).set({ count: existing.count + 1 }).where(eq(schema.votes.id, existing.id));
      else await db.insert(schema.votes).values({ meetingId: m.id, participantId: p.id, targetId, count: 1 });
      if (p.abstained) await db.update(schema.participants).set({ abstained: false }).where(eq(schema.participants.id, p.id));
      return;
    }
    case "vote.abstain": {
      const p = ensureContributor(ctx);
      const abstained = op.abstained !== false;
      if (abstained) await db.delete(schema.votes).where(and(eq(schema.votes.participantId, p.id), eq(schema.votes.meetingId, m.id)));
      const finished = abstained ? Array.from(new Set([...p.finishedSteps, "vote"])) : p.finishedSteps.filter((s) => s !== "vote");
      await db.update(schema.participants).set({ abstained, finishedSteps: finished }).where(eq(schema.participants.id, p.id));
      return;
    }
    case "vote.reset": {
      await ensureFacilitator(ctx);
      await db.delete(schema.votes).where(eq(schema.votes.meetingId, m.id));
      await db.update(schema.participants).set({ abstained: false }).where(eq(schema.participants.meetingId, m.id));
      return;
    }

    // ── Reactions ─────────────────────────────────────────────────────────
    case "reaction.toggle": {
      const p = ensureMember(ctx);
      const targetId = str(op.targetId, 64, true);
      const emoji = str(op.emoji, 16, true);
      const [existing] = await db
        .select()
        .from(schema.reactions)
        .where(and(eq(schema.reactions.targetId, targetId), eq(schema.reactions.userId, ctx.viewer.id), eq(schema.reactions.emoji, emoji)))
        .limit(1);
      if (existing) await db.delete(schema.reactions).where(eq(schema.reactions.id, existing.id));
      else await db.insert(schema.reactions).values({ meetingId: m.id, targetId, userId: ctx.viewer.id, participantId: p.id, emoji });
      return;
    }

    // ── Comments & chat ───────────────────────────────────────────────────
    case "comment.add": {
      const p = ensureMember(ctx);
      const targetType = str(op.targetType, 32, true);
      if (targetType === "chat") {
        const chat = m.options.chat ?? "everyone";
        if (chat === "disabled") throw new HttpError(403, "Chat is disabled");
        if (chat === "facilitators" && !isFacilitating(ctx)) throw new HttpError(403, "Only facilitators can post messages");
      } else if (m.options.comments === false && targetType !== "action" && targetType !== "update" && targetType !== "estimationItem") {
        throw new HttpError(403, "Comments are turned off");
      }
      const text = str(op.text, 4000);
      const attachments = (Array.isArray(op.attachments) ? op.attachments : []) as Attachment[];
      if (!text && !attachments.length) throw new HttpError(400, "Text is required");
      const [c] = await db
        .insert(schema.comments)
        .values({
          teamId: m.teamId,
          meetingId: m.id,
          targetType,
          targetId: targetType === "chat" ? m.id : str(op.targetId, 64, true),
          parentId: optStr(op.parentId, 64) || null,
          userId: ctx.viewer.id,
          participantId: p.id,
          text,
          attachments,
          anonymous: targetType !== "chat" && bool(op.anonymous) && !!m.options.allowAnonymousContributions,
        })
        .returning();
      await notifyMentions(ctx, text, c.id);
      return { id: c.id };
    }
    case "comment.update": {
      const [c] = await db.select().from(schema.comments).where(and(eq(schema.comments.id, String(op.id)), eq(schema.comments.meetingId, m.id))).limit(1);
      if (!c) throw new HttpError(404, "Comment not found");
      if (c.userId !== ctx.viewer.id) throw new HttpError(403, "You can only edit your own comments");
      await db.update(schema.comments).set({ text: str(op.text, 4000, true), updatedAt: new Date() }).where(eq(schema.comments.id, c.id));
      return;
    }
    case "comment.delete": {
      const [c] = await db.select().from(schema.comments).where(and(eq(schema.comments.id, String(op.id)), eq(schema.comments.meetingId, m.id))).limit(1);
      if (!c) throw new HttpError(404, "Comment not found");
      if (c.userId !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "You can only remove your own comments");
      await db.update(schema.comments).set({ deletedAt: new Date() }).where(eq(schema.comments.id, c.id));
      return;
    }
    case "comment.park": {
      const [c] = await db.select().from(schema.comments).where(and(eq(schema.comments.id, String(op.id)), eq(schema.comments.meetingId, m.id))).limit(1);
      if (!c) throw new HttpError(404, "Comment not found");
      const parked = op.parked !== false;
      await db.update(schema.comments).set({ parkedAt: parked ? new Date() : null }).where(eq(schema.comments.id, c.id));
      if (parked) await createActionItem(ctx, { kind: "parked", title: c.text, sourceType: "comment", sourceId: c.id, sourceText: c.text });
      else await removeParkedFor(ctx, c.id);
      return;
    }

    // ── Actions / agreements / parking lot ────────────────────────────────
    case "action.add": {
      ensureMember(ctx);
      const kind = (["action", "agreement", "parked"].includes(String(op.kind)) ? String(op.kind) : "action") as "action" | "agreement" | "parked";
      const propose = bool(op.propose);
      const perm =
        kind === "action"
          ? ((stepOf(ctx, m.type === "healthCheck" ? "healthDiscuss" : m.type === "estimation" ? "estimate" : "discuss")?.options ?? {}) as DiscussOptions).actionPermission
          : kind === "agreement"
            ? m.options.agreements
            : m.options.parkingLot;
      checkPermission(ctx, perm, propose);
      const st = optStr(op.sourceType, 32);
      const sid = optStr(op.sourceId, 64);
      const a = await createActionItem(ctx, {
        kind,
        title: str(op.title, 1000, true),
        description: optStr(op.description, 5000),
        status: propose ? "proposed" : "accepted",
        sourceType: st,
        sourceId: sid,
        sourceText: (await sourceText(ctx, st, sid)) ?? undefined,
        assigneeIds: Array.isArray(op.assigneeIds) ? op.assigneeIds.map(String) : [],
        dueDate: optStr(op.dueDate, 10) || null,
        priority: optStr(op.priority, 10) || null,
        ai: bool(op.ai),
      });
      return { id: a.id };
    }
    case "action.update": {
      const a = await getAction(ctx, op.id);
      if (a.status === "proposed" && op.status && !isFacilitating(ctx)) throw new HttpError(403, "Only facilitators can accept proposals");
      await updateActionItem(ctx.viewer.id, a, op);
      await bumpOtherTeamMeetings(ctx);
      return;
    }
    case "action.delete": {
      const a = await getAction(ctx, op.id);
      await db.update(schema.actionItems).set({ deletedAt: new Date() }).where(eq(schema.actionItems.id, a.id));
      if (a.kind === "parked" && a.sourceId) await unparkSource(a.sourceType, a.sourceId);
      await bumpOtherTeamMeetings(ctx);
      return;
    }
    case "action.vote": {
      ensureMember(ctx);
      const a = await getAction(ctx, op.id);
      const value = String(op.value);
      if (!["agree", "neutral", "disagree", "none"].includes(value)) throw new HttpError(400, "Bad vote");
      await db.delete(schema.actionVotes).where(and(eq(schema.actionVotes.actionId, a.id), eq(schema.actionVotes.userId, ctx.viewer.id)));
      if (value !== "none") await db.insert(schema.actionVotes).values({ actionId: a.id, userId: ctx.viewer.id, value });
      return;
    }
    case "action.reorder": {
      const a = await getAction(ctx, op.id);
      await db.update(schema.actionItems).set({ position: num(op.position) }).where(eq(schema.actionItems.id, a.id));
      return;
    }

    // ── Polls ─────────────────────────────────────────────────────────────
    case "poll.create": {
      const p = ensureContributor(ctx);
      const options = (Array.isArray(op.options) ? op.options : [])
        .map((o) => String(o).trim())
        .filter(Boolean)
        .slice(0, 12)
        .map((label, i) => ({ id: `o${i + 1}`, label }));
      if (options.length < 2) throw new HttpError(400, "Add at least two options");
      const question = str(op.question, 500, true);
      let ideaId = optStr(op.ideaId, 64) || null;
      if (!ideaId && op.topicId) {
        const topicId = String(op.topicId);
        const [idea] = await db
          .insert(schema.ideas)
          .values({
            meetingId: m.id,
            topicId,
            participantId: p.id,
            text: question,
            position: await nextPosition(schema.ideas, and(eq(schema.ideas.meetingId, m.id), eq(schema.ideas.topicId, topicId))!),
          })
          .returning();
        ideaId = idea.id;
      }
      const [poll] = await db
        .insert(schema.polls)
        .values({ meetingId: m.id, ideaId, question, options, revealed: op.revealed !== false, createdById: ctx.viewer.id })
        .returning();
      return { id: poll.id, ideaId };
    }
    case "poll.update": {
      const [poll] = await db.select().from(schema.polls).where(and(eq(schema.polls.id, String(op.id)), eq(schema.polls.meetingId, m.id))).limit(1);
      if (!poll) throw new HttpError(404, "Poll not found");
      if (poll.createdById !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "Not your poll");
      const patch: Partial<typeof schema.polls.$inferInsert> = {};
      if (op.question !== undefined) patch.question = str(op.question, 500, true);
      if (op.revealed !== undefined) patch.revealed = bool(op.revealed);
      if (Array.isArray(op.options)) patch.options = (op.options as { id?: string; label: string }[]).map((o, i) => ({ id: o.id || `o${Date.now()}${i}`, label: String(o.label).slice(0, 200) }));
      await db.update(schema.polls).set(patch).where(eq(schema.polls.id, poll.id));
      if (patch.question && poll.ideaId) await db.update(schema.ideas).set({ text: patch.question }).where(eq(schema.ideas.id, poll.ideaId));
      return;
    }
    case "poll.respond": {
      const p = ensureContributor(ctx);
      const pollId = str(op.id, 64, true);
      await db.delete(schema.pollResponses).where(and(eq(schema.pollResponses.pollId, pollId), eq(schema.pollResponses.participantId, p.id)));
      if (op.optionId) await db.insert(schema.pollResponses).values({ pollId, participantId: p.id, optionId: String(op.optionId) });
      return;
    }
    case "poll.delete": {
      const [poll] = await db.select().from(schema.polls).where(and(eq(schema.polls.id, String(op.id)), eq(schema.polls.meetingId, m.id))).limit(1);
      if (!poll) return;
      if (poll.createdById !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "Not your poll");
      await db.delete(schema.pollResponses).where(eq(schema.pollResponses.pollId, poll.id));
      await db.delete(schema.polls).where(eq(schema.polls.id, poll.id));
      return;
    }

    // ── Kudos ─────────────────────────────────────────────────────────────
    case "kudos.give": {
      ensureMember(ctx);
      if (m.options.kudos === false) throw new HttpError(403, "Kudos are turned off");
      const toUserId = str(op.toUserId, 64, true);
      const [k] = await db
        .insert(schema.kudos)
        .values({ teamId: m.teamId, meetingId: m.id, fromUserId: ctx.viewer.id, toUserId, type: str(op.kudosType, 32) || "thankYou", message: str(op.message, 500) })
        .returning();
      void dispatchEvent(m.teamId, "kudos.given", { meetingId: m.id, from: ctx.viewer.name, toUserId, type: k.type, message: k.message });
      void notifyKudos(ctx, toUserId, k.type, k.message);
      return { id: k.id };
    }
    case "kudos.delete": {
      const [k] = await db.select().from(schema.kudos).where(eq(schema.kudos.id, String(op.id))).limit(1);
      if (k && (k.fromUserId === ctx.viewer.id || isFacilitating(ctx))) await db.delete(schema.kudos).where(eq(schema.kudos.id, k.id));
      return;
    }

    // ── Flow / facilitation ───────────────────────────────────────────────
    case "step.goto": {
      await ensureFacilitator(ctx);
      const index = num(op.index, m.stepIndex);
      const step = m.steps[index];
      if (!step || !step.enabled) throw new HttpError(400, "That step is not enabled");
      const patch: Partial<typeof schema.meetings.$inferInsert> = { stepIndex: index, presenting: null };
      const wasClosed = m.status === "closed";
      if (step.key === "share" && !wasClosed) {
        patch.status = "closed";
        patch.closedAt = new Date();
      } else if (step.key !== "share" && wasClosed) {
        patch.status = "open";
        patch.closedAt = null;
      }
      await db.update(schema.meetings).set(patch).where(eq(schema.meetings.id, m.id));
      if (patch.status === "closed") await onMeetingClosed(m.id);
      if (patch.status === "open") void dispatchEvent(m.teamId, "meeting.reopened", { meetingId: m.id });
      emitTeamChange(m.teamId);
      return;
    }
    case "step.finish": {
      const p = ensureMember(ctx);
      const stepKey = str(op.step, 32) || currentKey(ctx) || "";
      const finished = op.finished !== false;
      const set = new Set(p.finishedSteps);
      if (finished) set.add(stepKey);
      else set.delete(stepKey);
      await db.update(schema.participants).set({ finishedSteps: [...set] }).where(eq(schema.participants.id, p.id));
      return;
    }
    case "meeting.update": {
      await ensureFacilitator(ctx);
      const patch: Partial<typeof schema.meetings.$inferInsert> = {};
      if (op.title !== undefined) patch.title = str(op.title, 64);
      if (op.date !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(String(op.date))) patch.date = String(op.date);
      if (op.context !== undefined) patch.context = str(op.context, 5000);
      if (op.contextMediaId !== undefined) patch.contextMediaId = optStr(op.contextMediaId, 64) || null;
      if (Array.isArray(op.topics)) patch.topics = (op.topics as Topic[]).map((t, i) => ({ ...t, id: t.id || `t${Date.now()}${i}`, title: String(t.title ?? "").slice(0, 200) }));
      if (Array.isArray(op.steps)) {
        const steps = op.steps as MeetingStep[];
        patch.steps = m.steps.map((s) => {
          const n = steps.find((x) => x.key === s.key);
          return n ? { key: s.key, enabled: s.key === m.steps[m.stepIndex]?.key ? true : !!n.enabled, options: { ...(s.options ?? {}), ...(n.options ?? {}) } } : s;
        });
        const welcome = patch.steps.find((s) => s.key === "welcome");
        const share = patch.steps.find((s) => s.key === "share");
        const ci = welcome?.enabled ? (welcome.options?.checkInQuestion as string | null) : null;
        const co = share?.enabled ? (share.options?.checkOutQuestion as string | null) : null;
        if ((ci ?? null) !== (m.checkIn?.question ?? null)) patch.checkIn = ci ? { question: ci, revealed: false } : null;
        if ((co ?? null) !== (m.checkOut?.question ?? null)) patch.checkOut = co ? { question: co, revealed: false } : null;
      }
      if (op.options && typeof op.options === "object") patch.options = { ...m.options, ...(op.options as MeetingOptions) };
      if (op.anonymity !== undefined) {
        const order: Anonymity[] = ["names", "aliases", "anonymous"];
        const next = String(op.anonymity) as Anonymity;
        if (order.indexOf(next) < order.indexOf(m.anonymity as Anonymity)) throw new HttpError(400, "Anonymity can't be reduced once enabled");
        if (order.includes(next)) patch.anonymity = next;
      }
      if (op.deck && typeof op.deck === "object") patch.deck = op.deck as typeof m.deck;
      if (op.collectingUntil !== undefined) patch.collectingUntil = op.collectingUntil ? new Date(String(op.collectingUntil)) : null;
      await db.update(schema.meetings).set(patch).where(eq(schema.meetings.id, m.id));
      if (patch.title !== undefined || patch.date !== undefined) emitTeamChange(m.teamId);
      return;
    }
    case "meeting.close": {
      await ensureFacilitator(ctx);
      const shareIdx = m.steps.findIndex((s) => s.key === "share" && s.enabled);
      await db
        .update(schema.meetings)
        .set({ status: "closed", closedAt: new Date(), presenting: null, ...(shareIdx >= 0 ? { stepIndex: shareIdx } : {}) })
        .where(eq(schema.meetings.id, m.id));
      await onMeetingClosed(m.id);
      emitTeamChange(m.teamId);
      return;
    }
    case "meeting.reopen": {
      await ensureFacilitator(ctx);
      let stepIndex = m.stepIndex;
      if (m.steps[stepIndex]?.key === "share") {
        for (let i = stepIndex - 1; i >= 0; i--) if (m.steps[i].enabled) { stepIndex = i; break; }
      }
      await db.update(schema.meetings).set({ status: "open", closedAt: null, stepIndex }).where(eq(schema.meetings.id, m.id));
      void dispatchEvent(m.teamId, "meeting.reopened", { meetingId: m.id });
      emitTeamChange(m.teamId);
      return;
    }
    case "notes.update": {
      await ensureFacilitator(ctx);
      await db.update(schema.meetings).set({ notes: str(op.notes, 20000) }).where(eq(schema.meetings.id, m.id));
      return;
    }
    case "timer.update": {
      await ensureFacilitator(ctx);
      const t: TimerState = m.timer ?? { status: "stopped", durationMs: 5 * 60_000, chime: true, music: null };
      const now = Date.now();
      const remaining = t.status === "running" && t.endsAt ? Math.max(0, new Date(t.endsAt).getTime() - now) : t.remainingMs ?? t.durationMs;
      const action = String(op.action);
      let next: TimerState = { ...t };
      if (action === "start") {
        const dur = op.durationMs !== undefined ? num(op.durationMs) : remaining || t.durationMs;
        next = { ...t, status: "running", durationMs: op.durationMs !== undefined ? dur : t.durationMs, endsAt: new Date(now + dur).toISOString(), remainingMs: null, startedBy: ctx.viewer.id };
      } else if (action === "pause") {
        next = { ...t, status: "paused", remainingMs: remaining, endsAt: null };
      } else if (action === "stop") {
        next = { ...t, status: "stopped", remainingMs: null, endsAt: null };
      } else if (action === "set") {
        const dur = Math.max(0, num(op.durationMs, t.durationMs));
        next = t.status === "running" ? { ...t, durationMs: dur, endsAt: new Date(now + dur).toISOString() } : { ...t, durationMs: dur, remainingMs: dur };
      } else if (action === "adjust") {
        const delta = num(op.deltaMs);
        if (t.status === "running" && t.endsAt) next = { ...t, endsAt: new Date(Math.max(now, new Date(t.endsAt).getTime() + delta)).toISOString() };
        else {
          const base = Math.max(0, (t.remainingMs ?? t.durationMs) + delta);
          next = { ...t, remainingMs: base, durationMs: t.status === "stopped" ? base : t.durationMs };
        }
      } else if (action === "settings") {
        if (op.chime !== undefined) next.chime = bool(op.chime);
        if (op.music !== undefined) next.music = op.music ? String(op.music) : null;
      }
      await db.update(schema.meetings).set({ timer: next }).where(eq(schema.meetings.id, m.id));
      return;
    }
    case "present.set": {
      await ensureFacilitator(ctx);
      const active = op.active !== false;
      const prevIds = m.presenting?.participantIds ?? [];
      const ids = active ? Array.from(new Set([...prevIds, ctx.participant!.id])) : [];
      await db
        .update(schema.meetings)
        .set({ presenting: { active, targetId: optStr(op.targetId, 64) ?? (active ? m.presenting?.targetId ?? null : null), participantIds: ids } })
        .where(eq(schema.meetings.id, m.id));
      return;
    }
    case "facilitate.start": {
      await ensureFacilitator(ctx);
      if (bool(op.exclusive)) {
        await db.update(schema.participants).set({ isFacilitating: false }).where(and(eq(schema.participants.meetingId, m.id), ne(schema.participants.id, ctx.participant!.id)));
      }
      return;
    }
    case "facilitate.stop": {
      if (ctx.participant) await db.update(schema.participants).set({ isFacilitating: false }).where(eq(schema.participants.id, ctx.participant.id));
      const still = await db.select({ id: schema.participants.id }).from(schema.participants).where(and(eq(schema.participants.meetingId, m.id), eq(schema.participants.isFacilitating, true)));
      if (!still.length) await db.update(schema.meetings).set({ presenting: null }).where(eq(schema.meetings.id, m.id));
      return;
    }
    case "facilitate.handOver": {
      await ensureFacilitator(ctx);
      const [target] = await db.select().from(schema.participants).where(and(eq(schema.participants.id, String(op.participantId)), eq(schema.participants.meetingId, m.id))).limit(1);
      if (!target) throw new HttpError(404, "Participant not found");
      await db
        .update(schema.participants)
        .set({ isFacilitating: true, role: target.role === "observer" ? "facilitatorOnly" : target.role === "participant" || target.role === "guest" ? "facilitator" : target.role })
        .where(eq(schema.participants.id, target.id));
      await db.update(schema.participants).set({ isFacilitating: false }).where(eq(schema.participants.id, ctx.participant!.id));
      return;
    }
    case "participant.update": {
      await ensureFacilitator(ctx);
      const [target] = await db.select().from(schema.participants).where(and(eq(schema.participants.id, String(op.participantId)), eq(schema.participants.meetingId, m.id))).limit(1);
      if (!target) throw new HttpError(404, "Participant not found");
      const patch: Partial<typeof schema.participants.$inferInsert> = {};
      if (op.role !== undefined && ["facilitator", "facilitatorOnly", "participant", "observer", "guest"].includes(String(op.role))) {
        patch.role = String(op.role);
        if (patch.role !== "facilitator" && patch.role !== "facilitatorOnly") patch.isFacilitating = false;
      }
      if (op.absent !== undefined) patch.absent = bool(op.absent);
      await db.update(schema.participants).set(patch).where(eq(schema.participants.id, target.id));
      return;
    }
    case "participant.remove": {
      await ensureFacilitator(ctx);
      const pid = String(op.participantId);
      if (pid === ctx.participant?.id) throw new HttpError(400, "You can't remove yourself");
      const ideas = await db.select({ id: schema.ideas.id, groupId: schema.ideas.groupId }).from(schema.ideas).where(and(eq(schema.ideas.meetingId, m.id), eq(schema.ideas.participantId, pid)));
      await deleteIdeas(ideas.map((i) => i.id));
      for (const g of new Set(ideas.map((i) => i.groupId))) await cleanupGroup(g);
      await db.delete(schema.votes).where(eq(schema.votes.participantId, pid));
      await db.delete(schema.healthRatings).where(eq(schema.healthRatings.participantId, pid));
      await db.delete(schema.estimationVotes).where(eq(schema.estimationVotes.participantId, pid));
      await db.delete(schema.standupUpdates).where(eq(schema.standupUpdates.participantId, pid));
      await db.update(schema.comments).set({ deletedAt: new Date() }).where(eq(schema.comments.participantId, pid));
      await db.delete(schema.participants).where(and(eq(schema.participants.id, pid), eq(schema.participants.meetingId, m.id)));
      return;
    }

    // ── Live feedback ─────────────────────────────────────────────────────
    case "live.send": {
      const p = ensureMember(ctx);
      const lf = m.options.liveFeedback ?? {};
      if (lf.enabled === false) throw new HttpError(403, "Live feedback is off");
      const kind = String(op.kind);
      if (kind === "reaction") {
        if (lf.reactions === false) return;
        await db.insert(schema.liveEvents).values({ meetingId: m.id, participantId: p.id, kind, emoji: str(op.emoji, 16), active: false });
        return;
      }
      const pairs: Record<string, string[]> = { agree: ["agree", "disagree"], disagree: ["agree", "disagree"], slower: ["slower", "faster"], faster: ["slower", "faster"], hand: ["hand"] };
      if (!pairs[kind]) throw new HttpError(400, "Unknown feedback");
      const [existing] = await db
        .select()
        .from(schema.liveEvents)
        .where(and(eq(schema.liveEvents.meetingId, m.id), eq(schema.liveEvents.participantId, p.id), eq(schema.liveEvents.kind, kind), eq(schema.liveEvents.active, true)))
        .limit(1);
      await db
        .update(schema.liveEvents)
        .set({ active: false })
        .where(and(eq(schema.liveEvents.meetingId, m.id), eq(schema.liveEvents.participantId, p.id), inArray(schema.liveEvents.kind, pairs[kind])));
      if (!existing) await db.insert(schema.liveEvents).values({ meetingId: m.id, participantId: p.id, kind, active: true });
      return;
    }
    case "live.clear": {
      await ensureFacilitator(ctx);
      await db.update(schema.liveEvents).set({ active: false }).where(and(eq(schema.liveEvents.meetingId, m.id), op.kind ? eq(schema.liveEvents.kind, String(op.kind)) : sql`true`));
      return;
    }

    // ── Check-in / check-out ──────────────────────────────────────────────
    case "check.respond": {
      const p = ensureMember(ctx);
      const kind = op.kind === "out" ? "out" : "in";
      const state = kind === "in" ? m.checkIn : m.checkOut;
      if (!state?.question) throw new HttpError(400, "No question set");
      const value = Math.min(5, Math.max(1, num(op.value, 3)));
      await db.delete(schema.checkResponses).where(and(eq(schema.checkResponses.participantId, p.id), eq(schema.checkResponses.kind, kind)));
      await db.insert(schema.checkResponses).values({ meetingId: m.id, participantId: p.id, kind, question: state.question, value });
      return;
    }
    case "check.reveal": {
      await ensureFacilitator(ctx);
      const kind = op.kind === "out" ? "out" : "in";
      const state = kind === "in" ? m.checkIn : m.checkOut;
      if (!state) return;
      await db
        .update(schema.meetings)
        .set(kind === "in" ? { checkIn: { ...state, revealed: op.revealed !== false } } : { checkOut: { ...state, revealed: op.revealed !== false } })
        .where(eq(schema.meetings.id, m.id));
      return;
    }

    // ── Health check ──────────────────────────────────────────────────────
    case "health.rate": {
      const p = ensureContributor(ctx);
      const dimensionId = str(op.dimensionId, 64, true);
      const [existing] = await db
        .select()
        .from(schema.healthRatings)
        .where(and(eq(schema.healthRatings.participantId, p.id), eq(schema.healthRatings.dimensionId, dimensionId)))
        .limit(1);
      const patch = {
        value: op.value === null ? null : op.value !== undefined ? num(op.value) : existing?.value ?? null,
        notApplicable: op.notApplicable !== undefined ? bool(op.notApplicable) : existing?.notApplicable ?? false,
        comment: op.comment !== undefined ? str(op.comment, 2000) : existing?.comment ?? "",
        updatedAt: new Date(),
      };
      if (patch.notApplicable) patch.value = null;
      if (existing) await db.update(schema.healthRatings).set(patch).where(eq(schema.healthRatings.id, existing.id));
      else await db.insert(schema.healthRatings).values({ meetingId: m.id, participantId: p.id, dimensionId, ...patch });
      return;
    }

    // ── Estimation ────────────────────────────────────────────────────────
    case "estimation.add": {
      ensureMember(ctx);
      if (!isFacilitating(ctx) && ctx.participant?.role === "observer") throw new HttpError(403, "Observers can't add items");
      const items = Array.isArray(op.items) ? (op.items as Record<string, unknown>[]) : [op];
      let pos = await nextPosition(schema.estimationItems, eq(schema.estimationItems.meetingId, m.id));
      const ids: string[] = [];
      for (const it of items) {
        const title = str(it.title, 500);
        if (!title) continue;
        const [row] = await db
          .insert(schema.estimationItems)
          .values({
            meetingId: m.id,
            teamId: m.teamId,
            title,
            description: str(it.description, 5000),
            url: optStr(it.url, 1000) || null,
            externalKey: optStr(it.externalKey, 200) || null,
            externalSource: optStr(it.externalSource, 64) || null,
            position: pos++,
          })
          .returning();
        ids.push(row.id);
      }
      return { ids };
    }
    case "estimation.update": {
      const [it] = await db.select().from(schema.estimationItems).where(and(eq(schema.estimationItems.id, String(op.id)), eq(schema.estimationItems.meetingId, m.id))).limit(1);
      if (!it) throw new HttpError(404, "Item not found");
      const patch: Partial<typeof schema.estimationItems.$inferInsert> = {};
      if (op.title !== undefined) patch.title = str(op.title, 500, true);
      if (op.description !== undefined) patch.description = str(op.description, 5000);
      if (op.url !== undefined) patch.url = optStr(op.url, 1000) || null;
      if (op.position !== undefined) patch.position = num(op.position);
      if (op.finalEstimate !== undefined) {
        await ensureFacilitator(ctx);
        patch.finalEstimate = op.finalEstimate === null ? null : str(op.finalEstimate, 32);
      }
      if (op.phase !== undefined) {
        await ensureFacilitator(ctx);
        const phase = String(op.phase);
        if (!["discuss", "estimate", "review"].includes(phase)) throw new HttpError(400, "Bad phase");
        patch.phase = phase;
        if (phase === "review" && !it.finalEstimate && op.finalEstimate === undefined) {
          const vs = await db.select().from(schema.estimationVotes).where(eq(schema.estimationVotes.itemId, it.id));
          patch.finalEstimate = computeEstimate(vs.map((v) => v.value), m.deck?.cards ?? []);
        }
      }
      await db.update(schema.estimationItems).set(patch).where(eq(schema.estimationItems.id, it.id));
      if (patch.finalEstimate && m.options.autoSyncEstimates) {
        const { syncEstimate } = await import("../integrations/publish");
        void syncEstimate(it.id).catch(() => {});
      }
      return;
    }
    case "estimation.delete": {
      await db.delete(schema.estimationVotes).where(eq(schema.estimationVotes.itemId, String(op.id)));
      await db.delete(schema.estimationItems).where(and(eq(schema.estimationItems.id, String(op.id)), eq(schema.estimationItems.meetingId, m.id)));
      return;
    }
    case "estimation.vote": {
      const p = ensureContributor(ctx);
      const itemId = str(op.itemId, 64, true);
      const [it] = await db.select().from(schema.estimationItems).where(and(eq(schema.estimationItems.id, itemId), eq(schema.estimationItems.meetingId, m.id))).limit(1);
      if (!it) throw new HttpError(404, "Item not found");
      if (it.phase === "review" && !isFacilitating(ctx)) throw new HttpError(400, "Estimates are already revealed");
      await db.delete(schema.estimationVotes).where(and(eq(schema.estimationVotes.itemId, itemId), eq(schema.estimationVotes.participantId, p.id)));
      if (op.value !== null && op.value !== undefined && op.value !== "") {
        await db.insert(schema.estimationVotes).values({ itemId, meetingId: m.id, participantId: p.id, value: str(op.value, 32) });
      }
      if (it.phase === "discuss") await db.update(schema.estimationItems).set({ phase: "estimate" }).where(eq(schema.estimationItems.id, itemId));
      return;
    }
    case "estimation.revote": {
      await ensureFacilitator(ctx);
      const itemId = str(op.itemId, 64, true);
      await db.delete(schema.estimationVotes).where(eq(schema.estimationVotes.itemId, itemId));
      await db.update(schema.estimationItems).set({ phase: "estimate", finalEstimate: null }).where(eq(schema.estimationItems.id, itemId));
      return;
    }

    // ── Standup ───────────────────────────────────────────────────────────
    case "standup.add": {
      const p = ensureContributor(ctx);
      const topicId = str(op.topicId, 64, true);
      const topic = m.topics.find((t) => t.id === topicId);
      if (!topic) throw new HttpError(400, "Unknown question");
      const text = str(op.text, 2000, true);
      const mentions = Array.isArray(op.mentions) ? op.mentions.map(String) : [];
      let dayCount = 1;
      const carriedFromId = optStr(op.carriedFromId, 64) || null;
      if (carriedFromId) {
        const [prev] = await db.select().from(schema.standupUpdates).where(eq(schema.standupUpdates.id, carriedFromId)).limit(1);
        dayCount = (prev?.dayCount ?? 0) + 1;
      }
      const [u] = await db
        .insert(schema.standupUpdates)
        .values({
          meetingId: m.id,
          teamId: m.teamId,
          participantId: p.id,
          userId: ctx.viewer.id,
          topicId,
          type: (optStr(op.updateType, 16) as string | undefined) ?? topic.type ?? null,
          text,
          carriedFromId,
          carryStatus: optStr(op.carryStatus, 16) || null,
          dayCount,
          mentions,
          position: await nextPosition(schema.standupUpdates, and(eq(schema.standupUpdates.meetingId, m.id), eq(schema.standupUpdates.participantId, p.id))!),
        })
        .returning();
      await notifyMentions(ctx, text, u.id, mentions);
      void dispatchEvent(m.teamId, "standup.update", { meetingId: m.id, user: ctx.viewer.name, topic: topic.title, text });
      return { id: u.id };
    }
    case "standup.update": {
      const [u] = await db.select().from(schema.standupUpdates).where(and(eq(schema.standupUpdates.id, String(op.id)), eq(schema.standupUpdates.meetingId, m.id))).limit(1);
      if (!u) throw new HttpError(404, "Update not found");
      if (u.userId !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "Not your update");
      if (m.status === "closed") throw new HttpError(400, "This standup is closed. Updates can no longer be edited.");
      const patch: Partial<typeof schema.standupUpdates.$inferInsert> = { updatedAt: new Date() };
      if (op.text !== undefined) patch.text = str(op.text, 2000, true);
      if (op.topicId !== undefined) patch.topicId = String(op.topicId);
      if (op.updateType !== undefined) patch.type = optStr(op.updateType, 16) || null;
      if (op.carryStatus !== undefined) patch.carryStatus = optStr(op.carryStatus, 16) || null;
      if (op.position !== undefined) patch.position = num(op.position);
      await db.update(schema.standupUpdates).set(patch).where(eq(schema.standupUpdates.id, u.id));
      return;
    }
    case "standup.delete": {
      const [u] = await db.select().from(schema.standupUpdates).where(and(eq(schema.standupUpdates.id, String(op.id)), eq(schema.standupUpdates.meetingId, m.id))).limit(1);
      if (!u) return;
      if (u.userId !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "Not your update");
      await db.delete(schema.standupUpdates).where(eq(schema.standupUpdates.id, u.id));
      return;
    }

    // ── Whiteboards ───────────────────────────────────────────────────────
    case "whiteboard.create": {
      ensureMember(ctx);
      if ((m.options.whiteboards ?? "everyone") === "facilitators" && !isFacilitating(ctx)) throw new HttpError(403, "Only facilitators can create whiteboards");
      const [w] = await db
        .insert(schema.whiteboards)
        .values({
          meetingId: m.id,
          teamId: m.teamId,
          title: str(op.title, 200) || "Whiteboard",
          attachedType: optStr(op.attachedType, 16) || "meeting",
          attachedId: optStr(op.attachedId, 64) || null,
          editPermission: op.editPermission === "creator" ? "creator" : "everyone",
          createdById: ctx.viewer.id,
        })
        .returning();
      return { id: w.id };
    }
    case "whiteboard.update": {
      const [w] = await db.select().from(schema.whiteboards).where(and(eq(schema.whiteboards.id, String(op.id)), eq(schema.whiteboards.meetingId, m.id))).limit(1);
      if (!w) throw new HttpError(404, "Whiteboard not found");
      if (w.createdById !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "Only the creator can change this");
      const patch: Partial<typeof schema.whiteboards.$inferInsert> = { updatedAt: new Date() };
      if (op.title !== undefined) patch.title = str(op.title, 200);
      if (op.editPermission !== undefined) patch.editPermission = op.editPermission === "creator" ? "creator" : "everyone";
      await db.update(schema.whiteboards).set(patch).where(eq(schema.whiteboards.id, w.id));
      return;
    }
    case "whiteboard.delete": {
      const [w] = await db.select().from(schema.whiteboards).where(and(eq(schema.whiteboards.id, String(op.id)), eq(schema.whiteboards.meetingId, m.id))).limit(1);
      if (!w) return;
      if (w.createdById !== ctx.viewer.id && !isFacilitating(ctx)) throw new HttpError(403, "Only the creator can delete this");
      await db.update(schema.whiteboards).set({ deletedAt: new Date() }).where(eq(schema.whiteboards.id, w.id));
      return;
    }

    // ── Icebreakers ───────────────────────────────────────────────────────
    case "icebreaker.set": {
      await ensureFacilitator(ctx);
      const cur: IcebreakerState = m.icebreaker ?? { mode: "game" };
      const next: IcebreakerState = { ...cur };
      for (const k of ["mode", "gameKey", "phase", "round", "data", "question", "category", "history"] as const) {
        if (op[k] !== undefined) (next as Record<string, unknown>)[k] = op[k];
      }
      if (op.gameKey !== undefined && op.gameKey !== cur.gameKey) {
        next.round = 0;
        next.phase = "lobby";
        next.data = (op.data as Record<string, unknown>) ?? {};
        await db.delete(schema.icebreakerEntries).where(eq(schema.icebreakerEntries.meetingId, m.id));
      }
      if (bool(op.clearEntries)) {
        await db
          .delete(schema.icebreakerEntries)
          .where(and(eq(schema.icebreakerEntries.meetingId, m.id), op.clearRound !== undefined ? eq(schema.icebreakerEntries.round, num(op.clearRound)) : sql`true`));
      }
      await db.update(schema.meetings).set({ icebreaker: next }).where(eq(schema.meetings.id, m.id));
      return;
    }
    case "icebreaker.entry": {
      const p = ensureMember(ctx);
      const kind = str(op.kind, 32) || "answer";
      const round = num(op.round, m.icebreaker?.round ?? 0);
      if (bool(op.replace)) {
        await db
          .delete(schema.icebreakerEntries)
          .where(and(eq(schema.icebreakerEntries.meetingId, m.id), eq(schema.icebreakerEntries.participantId, p.id), eq(schema.icebreakerEntries.round, round), eq(schema.icebreakerEntries.kind, kind)));
      }
      const payload = (op.payload && typeof op.payload === "object" ? op.payload : {}) as Record<string, unknown>;
      if (JSON.stringify(payload).length > 400_000) throw new HttpError(400, "Too large");
      await db.insert(schema.icebreakerEntries).values({ meetingId: m.id, participantId: p.id, round, kind, payload });
      return;
    }

    case "icebreaker.clear": {
      const p = ensureMember(ctx);
      const all = bool(op.all) && isFacilitating(ctx);
      await db
        .delete(schema.icebreakerEntries)
        .where(
          and(
            eq(schema.icebreakerEntries.meetingId, m.id),
            all ? sql`true` : eq(schema.icebreakerEntries.participantId, p.id),
            op.kind ? eq(schema.icebreakerEntries.kind, String(op.kind)) : sql`true`,
            op.round !== undefined ? eq(schema.icebreakerEntries.round, num(op.round)) : sql`true`,
          ),
        );
      return;
    }

    default:
      throw new HttpError(400, `Unknown operation ${op.type}`);
  }
}

export function computeEstimate(values: string[], cards: { label: string; value?: number | null }[]) {
  if (!values.length) return null;
  const numeric = values.map((v) => cards.find((c) => c.label === v)?.value).filter((n): n is number => typeof n === "number");
  if (numeric.length && numeric.length === values.filter((v) => cards.find((c) => c.label === v && c.value !== undefined)).length) {
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    return String(Math.round(avg * 10) / 10);
  }
  // text cards: pick the middle card in deck order
  const order = cards.map((c) => c.label);
  const ranked = values.filter((v) => order.includes(v)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return ranked.length ? ranked[Math.floor((ranked.length - 1) / 2)] : values[0];
}

async function deleteIdeas(ids: string[]) {
  if (!ids.length) return;
  await db.delete(schema.votes).where(inArray(schema.votes.targetId, ids));
  await db.delete(schema.reactions).where(inArray(schema.reactions.targetId, ids));
  await db.update(schema.comments).set({ deletedAt: new Date() }).where(inArray(schema.comments.targetId, ids));
  const polls = await db.select({ id: schema.polls.id }).from(schema.polls).where(inArray(schema.polls.ideaId, ids));
  if (polls.length) {
    await db.delete(schema.pollResponses).where(inArray(schema.pollResponses.pollId, polls.map((p) => p.id)));
    await db.delete(schema.polls).where(inArray(schema.polls.id, polls.map((p) => p.id)));
  }
  await db.delete(schema.ideas).where(inArray(schema.ideas.id, ids));
}

async function removeParkedFor(ctx: MeetingContext, sourceId: string) {
  await db
    .update(schema.actionItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.actionItems.teamId, ctx.team.id), eq(schema.actionItems.kind, "parked"), eq(schema.actionItems.sourceId, sourceId), isNull(schema.actionItems.deletedAt)));
}

async function unparkSource(sourceType: string | null, sourceId: string) {
  if (sourceType === "idea") await db.update(schema.ideas).set({ parkedAt: null }).where(eq(schema.ideas.id, sourceId));
  if (sourceType === "group") await db.update(schema.ideaGroups).set({ parkedAt: null }).where(eq(schema.ideaGroups.id, sourceId));
  if (sourceType === "comment") await db.update(schema.comments).set({ parkedAt: null }).where(eq(schema.comments.id, sourceId));
}

export async function createActionItem(
  ctx: MeetingContext,
  input: {
    kind: "action" | "agreement" | "parked";
    title: string;
    description?: string;
    status?: string;
    sourceType?: string;
    sourceId?: string;
    sourceText?: string | null;
    assigneeIds?: string[];
    dueDate?: string | null;
    priority?: string | null;
    ai?: boolean;
  },
) {
  const pos = await nextPosition(schema.actionItems, and(eq(schema.actionItems.teamId, ctx.team.id), eq(schema.actionItems.kind, input.kind))!);
  const [a] = await db
    .insert(schema.actionItems)
    .values({
      teamId: ctx.team.id,
      meetingId: ctx.meeting.id,
      kind: input.kind,
      title: input.title.slice(0, 1000),
      description: input.description ?? "",
      status: input.status ?? "accepted",
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      sourceText: input.sourceText ?? null,
      sourceMeetingTitle: ctx.meeting.title || ctx.meeting.templateName || ctx.meeting.date,
      assigneeIds: input.assigneeIds ?? [],
      dueDate: input.dueDate ?? null,
      priority: input.priority ?? null,
      ai: !!input.ai,
      position: pos,
      createdById: ctx.viewer.id,
      participantId: ctx.participant?.id ?? null,
    })
    .returning();
  if (a.status === "accepted") {
    void dispatchEvent(ctx.team.id, a.kind === "agreement" ? "agreement.created" : "action.created", {
      id: a.id,
      title: a.title,
      meetingId: ctx.meeting.id,
      url: appUrl(`/t/${ctx.team.id}`),
    });
  }
  await bumpOtherTeamMeetings(ctx);
  return a;
}

export async function updateActionItem(userId: string, a: typeof schema.actionItems.$inferSelect, op: Record<string, unknown>) {
  const patch: Partial<typeof schema.actionItems.$inferInsert> = { updatedAt: new Date() };
  if (op.title !== undefined) patch.title = str(op.title, 1000, true);
  if (op.description !== undefined) patch.description = str(op.description, 5000);
  if (op.assigneeIds !== undefined) patch.assigneeIds = Array.isArray(op.assigneeIds) ? op.assigneeIds.map(String) : [];
  if (op.dueDate !== undefined) patch.dueDate = op.dueDate ? String(op.dueDate).slice(0, 10) : null;
  if (op.priority !== undefined) patch.priority = op.priority ? String(op.priority) : null;
  if (op.position !== undefined) patch.position = num(op.position);
  if (op.kind !== undefined && ["action", "agreement", "parked"].includes(String(op.kind))) patch.kind = String(op.kind);
  if (op.status !== undefined) {
    const status = String(op.status);
    if (!["proposed", "suggested", "accepted", "rejected", "completed", "canceled"].includes(status)) throw new HttpError(400, "Bad status");
    patch.status = status;
    if (status === "completed") {
      patch.completedAt = new Date();
      patch.completedById = userId;
    } else if (a.status === "completed") {
      patch.completedAt = null;
      patch.completedById = null;
    }
  }
  await db.update(schema.actionItems).set(patch).where(eq(schema.actionItems.id, a.id));
  if (patch.status === "completed") void dispatchEvent(a.teamId, "action.completed", { id: a.id, title: a.title });
  else void dispatchEvent(a.teamId, "action.updated", { id: a.id, title: patch.title ?? a.title, status: patch.status ?? a.status });
  if (patch.status === "accepted" && a.status !== "accepted") void dispatchEvent(a.teamId, a.kind === "agreement" ? "agreement.created" : "action.created", { id: a.id, title: a.title });
}

/** Team actions show up in every open meeting of the team; nudge them all. */
async function bumpOtherTeamMeetings(ctx: MeetingContext) {
  const { bumpTeamMeetings } = await import("../team-events");
  await bumpTeamMeetings(ctx.team.id, ctx.meeting.id);
}

async function notifyMentions(ctx: MeetingContext, text: string, refId: string, explicit: string[] = []) {
  const { notifyMentions: notify } = await import("../notifications");
  await notify({ teamId: ctx.team.id, meetingId: ctx.meeting.id, fromUser: ctx.viewer, text, refId, explicitUserIds: explicit });
}

async function notifyKudos(ctx: MeetingContext, toUserId: string, type: string, message: string) {
  const { notifyKudos: notify } = await import("../notifications");
  await notify({ fromUser: ctx.viewer, toUserId, teamId: ctx.team.id, type, message });
}
