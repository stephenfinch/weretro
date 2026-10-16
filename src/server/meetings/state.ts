import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "../auth";
import type {
  ActionDTO,
  CheckDTO,
  CommentDTO,
  EstimationItemDTO,
  GroupDTO,
  HealthDTO,
  IdeaDTO,
  MeetingStateDTO,
  ParticipantDTO,
  PollDTO,
  ReactionDTO,
  StandupUpdateDTO,
} from "@/lib/meeting-types";
import type { BrainstormOptions, ParticipantRole, VoteOptions } from "@/lib/types";
import { getHealthModelFull } from "../health-models";
import { canFacilitateMeeting, type MeetingContext } from "./context";

export const mediaUrl = (id: string | null | undefined) => (id ? `/api/media/${id}` : null);

const ONLINE_MS = 35_000;
const TYPING_MS = 6_000;

function stepIdx(m: { steps: { key: string; enabled: boolean }[] }, key: string) {
  return m.steps.findIndex((s) => s.key === key && s.enabled);
}

function stats(values: number[]) {
  if (!values.length) return { mean: null, median: null, mode: null, stdDev: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let mode = sorted[0];
  let best = 0;
  for (const [v, c] of counts) if (c > best) [mode, best] = [v, c];
  const stdDev = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  return { mean, median, mode, stdDev, min: sorted[0], max: sorted[sorted.length - 1] };
}

export async function buildMeetingState(ctx: MeetingContext, viewer: CurrentUser): Promise<MeetingStateDTO> {
  const { meeting, team, org, participant: myP, teamAccess } = ctx;
  const now = Date.now();
  const steps = meeting.steps;
  const currentKey = steps[meeting.stepIndex]?.key;
  const closed = meeting.status === "closed";
  const anonymity = meeting.anonymity as "names" | "aliases" | "anonymous";

  // ── Participants ────────────────────────────────────────────────────────
  const pRows = await db
    .select({ p: schema.participants, u: schema.users })
    .from(schema.participants)
    .innerJoin(schema.users, eq(schema.users.id, schema.participants.userId))
    .where(eq(schema.participants.meetingId, meeting.id))
    .orderBy(asc(schema.participants.createdAt));

  const named = (role: string) => role === "observer" || role === "facilitatorOnly";
  const displayName = (p: typeof schema.participants.$inferSelect, u: typeof schema.users.$inferSelect) => {
    if (p.userId === viewer.id) return u.name;
    if (anonymity === "names" || named(p.role)) return u.name;
    if (anonymity === "aliases") return p.alias ?? "Anonymous";
    return "Anonymous";
  };
  const partById = new Map(pRows.map((r) => [r.p.id, r]));
  const participants: ParticipantDTO[] = pRows.map(({ p, u }) => {
    const hideIdentity = anonymity !== "names" && !named(p.role) && p.userId !== viewer.id;
    return {
      id: p.id,
      userId: hideIdentity ? null : p.userId,
      name: displayName(p, u),
      initials: hideIdentity ? (anonymity === "aliases" ? (p.alias ?? "?").split(" ").map((s) => s[0]).join("") : "?") : u.initials ?? "?",
      color: hideIdentity ? p.aliasColor ?? "#94A3B8" : u.color,
      avatarUrl: hideIdentity ? null : mediaUrl(u.avatarMediaId),
      role: p.role as ParticipantRole,
      finishedSteps: p.finishedSteps,
      abstained: p.abstained,
      absent: p.absent,
      online: !!p.lastSeenAt && now - p.lastSeenAt.getTime() < ONLINE_MS,
      typing: !!p.typingAt && now - p.typingAt.getTime() < TYPING_MS,
      isFacilitating: p.isFacilitating,
      invited: !p.joinedAt,
      isGuest: u.isGuest,
      isMe: p.userId === viewer.id,
    };
  });
  const nameOf = (participantId: string | null | undefined) => {
    if (!participantId) return "Anonymous";
    const r = partById.get(participantId);
    return r ? displayName(r.p, r.u) : "Someone";
  };

  const canContributeRoles = ["facilitator", "participant", "guest"];
  const canFacilitate = canFacilitateMeeting(ctx);
  const me = {
    participantId: myP?.id ?? null,
    userId: viewer.id,
    name: viewer.name,
    role: (myP?.role ?? null) as ParticipantRole | null,
    isFacilitator: !!myP?.isFacilitating && canFacilitate,
    canFacilitate,
    canContribute: !!myP && canContributeRoles.includes(myP.role) && !closed,
    isTeamMember: !!teamAccess?.isMember,
    isGuest: viewer.isGuest,
  };

  // ── Team members (for assignment, kudos, mentions) ──────────────────────
  const memberRows = await db
    .select({ u: schema.users })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.teamId, team.id));
  const memberMap = new Map(memberRows.map((r) => [r.u.id, r.u]));
  for (const { u } of pRows) if (!memberMap.has(u.id)) memberMap.set(u.id, u);
  const members = [...memberMap.values()]
    .filter((u) => !u.isGuest)
    .map((u) => ({ userId: u.id, name: u.name, color: u.color, avatarUrl: mediaUrl(u.avatarMediaId) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // ── Reactions (all targets in this meeting) ─────────────────────────────
  const reactionRows = await db.select().from(schema.reactions).where(eq(schema.reactions.meetingId, meeting.id));
  const reactionsFor = (targetId: string): ReactionDTO[] => {
    const list = reactionRows.filter((r) => r.targetId === targetId);
    const byEmoji = new Map<string, ReactionDTO>();
    for (const r of list) {
      const e = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] };
      e.count++;
      if (r.userId === viewer.id) e.mine = true;
      if (anonymity === "names") e.names.push(r.participantId ? nameOf(r.participantId) : memberMap.get(r.userId)?.name ?? "");
      byEmoji.set(r.emoji, e);
    }
    return [...byEmoji.values()];
  };

  // ── Comments ────────────────────────────────────────────────────────────
  const commentRows = await db
    .select()
    .from(schema.comments)
    .where(and(eq(schema.comments.meetingId, meeting.id), isNull(schema.comments.deletedAt)))
    .orderBy(asc(schema.comments.createdAt));
  const toComment = (c: typeof schema.comments.$inferSelect): CommentDTO => {
    const isChat = c.targetType === "chat";
    const hide = !isChat && (c.anonymous || (anonymity === "anonymous" && c.userId !== viewer.id));
    const p = c.participantId ? partById.get(c.participantId) : undefined;
    const u = p?.u ?? memberMap.get(c.userId);
    let authorName = u?.name ?? "Someone";
    if (!isChat && p) authorName = displayName(p.p, p.u);
    if (hide) authorName = "Anonymous";
    return {
      id: c.id,
      targetType: c.targetType,
      targetId: c.targetId,
      parentId: c.parentId,
      authorId: hide ? null : c.participantId,
      authorName,
      authorColor: hide ? "#94A3B8" : anonymity === "aliases" && p && !isChat ? p.p.aliasColor ?? "#94A3B8" : u?.color ?? "#94A3B8",
      authorAvatarUrl: hide || (anonymity !== "names" && !isChat) ? null : mediaUrl(u?.avatarMediaId),
      mine: c.userId === viewer.id,
      text: c.text,
      anonymous: c.anonymous,
      parked: !!c.parkedAt,
      attachments: c.attachments,
      reactions: reactionsFor(c.id),
      createdAt: c.createdAt.toISOString(),
    };
  };
  const comments = commentRows.filter((c) => c.targetType !== "chat").map(toComment);
  const chat = commentRows.filter((c) => c.targetType === "chat").map(toComment);
  const commentCount = (targetId: string) => commentRows.filter((c) => c.targetId === targetId && c.targetType !== "chat").length;

  // ── Polls ───────────────────────────────────────────────────────────────
  const pollRows = await db.select().from(schema.polls).where(eq(schema.polls.meetingId, meeting.id));
  const pollIds = pollRows.map((p) => p.id);
  const pollResponses = pollIds.length ? await db.select().from(schema.pollResponses).where(inArray(schema.pollResponses.pollId, pollIds)) : [];
  const polls: PollDTO[] = pollRows.map((p) => {
    const rs = pollResponses.filter((r) => r.pollId === p.id);
    const mine = rs.find((r) => r.participantId === myP?.id);
    return {
      id: p.id,
      ideaId: p.ideaId,
      question: p.question,
      options: p.options.map((o) => ({ ...o, count: p.revealed || closed ? rs.filter((r) => r.optionId === o.id).length : null })),
      revealed: p.revealed,
      myOptionId: mine?.optionId ?? null,
      responded: rs.length,
      canEdit: p.createdById === viewer.id || me.isFacilitator,
    };
  });

  // ── Ideas, groups, votes ────────────────────────────────────────────────
  const ideaRows = await db.select().from(schema.ideas).where(eq(schema.ideas.meetingId, meeting.id)).orderBy(asc(schema.ideas.position));
  const groupRows = await db.select().from(schema.ideaGroups).where(eq(schema.ideaGroups.meetingId, meeting.id)).orderBy(asc(schema.ideaGroups.position));
  const voteRows = await db.select().from(schema.votes).where(eq(schema.votes.meetingId, meeting.id));

  const bIdx = stepIdx(meeting, "brainstorm");
  const bOpts = (steps[bIdx]?.options ?? {}) as BrainstormOptions;
  const hideOthers = !closed && currentKey === "brainstorm" && (bOpts.showIdea ?? "nextStep") === "nextStep";
  const showAuthors = (bOpts.showAvatar ?? "hidden") === "shown" && anonymity !== "anonymous";
  const vIdx = stepIdx(meeting, "vote");
  const vOpts = (steps[vIdx]?.options ?? {}) as VoteOptions;
  const votesRevealed = vIdx >= 0 && (closed || meeting.stepIndex > vIdx || (meeting.stepIndex === vIdx && vOpts.reveal === "immediately"));
  const votersVisible = votesRevealed && vOpts.anonymous === false;

  const votesFor = (targetId: string) => {
    const list = voteRows.filter((v) => v.targetId === targetId);
    return {
      total: list.reduce((a, v) => a + v.count, 0),
      mine: list.filter((v) => v.participantId === myP?.id).reduce((a, v) => a + v.count, 0),
      voterIds: list.map((v) => v.participantId),
    };
  };

  const hiddenIdeaCounts: Record<string, number> = {};
  const ideas: IdeaDTO[] = [];
  for (const i of ideaRows) {
    const mine = i.participantId === myP?.id;
    if (hideOthers && !mine) {
      hiddenIdeaCounts[i.topicId] = (hiddenIdeaCounts[i.topicId] ?? 0) + 1;
      continue;
    }
    const v = votesFor(i.id);
    ideas.push({
      id: i.id,
      topicId: i.topicId,
      authorId: !i.anonymous && (showAuthors || mine) ? i.participantId : null,
      mine,
      hidden: false,
      text: i.text,
      color: i.color,
      anonymous: i.anonymous,
      groupId: i.groupId,
      position: i.position,
      attachments: i.attachments,
      parked: !!i.parkedAt,
      votes: votesRevealed ? v.total : null,
      myVotes: v.mine,
      voterIds: votersVisible ? v.voterIds : null,
      reactions: reactionsFor(i.id),
      commentCount: commentCount(i.id),
      poll: polls.find((p) => p.ideaId === i.id) ?? null,
      createdAt: i.createdAt.toISOString(),
    });
  }
  const groups: GroupDTO[] = groupRows.map((g) => {
    const v = votesFor(g.id);
    return {
      id: g.id,
      topicId: g.topicId,
      title: g.title,
      position: g.position,
      suggested: g.suggested,
      parked: !!g.parkedAt,
      votes: votesRevealed ? v.total : null,
      myVotes: v.mine,
      voterIds: votersVisible ? v.voterIds : null,
    };
  });
  const myUsed = voteRows.filter((v) => v.participantId === myP?.id).reduce((a, v) => a + v.count, 0);
  const maxVotes = vOpts.maxVotes === undefined ? 5 : vOpts.maxVotes;
  const unlimited = maxVotes === null || (vOpts.facilitatorUnlimited && me.isFacilitator);

  // ── Actions, agreements, parking lot ────────────────────────────────────
  const actionRows = await db
    .select()
    .from(schema.actionItems)
    .where(
      and(
        eq(schema.actionItems.teamId, team.id),
        isNull(schema.actionItems.deletedAt),
        or(
          eq(schema.actionItems.meetingId, meeting.id),
          and(ne(schema.actionItems.kind, "action"), notInArray(schema.actionItems.status, ["rejected", "canceled", "completed", "proposed", "suggested"])),
          and(eq(schema.actionItems.kind, "action"), notInArray(schema.actionItems.status, ["completed", "canceled", "rejected", "proposed", "suggested"])),
          and(eq(schema.actionItems.kind, "action"), eq(schema.actionItems.status, "completed"), gt(schema.actionItems.completedAt, meeting.createdAt)),
        ),
      ),
    )
    .orderBy(asc(schema.actionItems.position), asc(schema.actionItems.createdAt));
  const actionIds = actionRows.map((a) => a.id);
  const actionVoteRows = actionIds.length ? await db.select().from(schema.actionVotes).where(inArray(schema.actionVotes.actionId, actionIds)) : [];
  const actionCommentCounts = actionIds.length
    ? await db
        .select({ targetId: schema.comments.targetId, n: sql<number>`count(*)::int` })
        .from(schema.comments)
        .where(and(inArray(schema.comments.targetId, actionIds), isNull(schema.comments.deletedAt)))
        .groupBy(schema.comments.targetId)
    : [];
  const actions: ActionDTO[] = actionRows.map((a) => toActionDTO(a, memberMap, actionVoteRows, actionCommentCounts, viewer.id));

  // ── Kudos ───────────────────────────────────────────────────────────────
  const kudosRows = await db.select().from(schema.kudos).where(eq(schema.kudos.meetingId, meeting.id)).orderBy(asc(schema.kudos.createdAt));
  const kudos = kudosRows.map((k) => ({
    id: k.id,
    fromUserId: k.fromUserId,
    fromName: memberMap.get(k.fromUserId)?.name ?? "Someone",
    toUserId: k.toUserId,
    toName: memberMap.get(k.toUserId)?.name ?? "Someone",
    type: k.type,
    message: k.message,
    createdAt: k.createdAt.toISOString(),
  }));

  // ── Whiteboards ─────────────────────────────────────────────────────────
  const wbRows = await db
    .select({
      id: schema.whiteboards.id,
      title: schema.whiteboards.title,
      attachedType: schema.whiteboards.attachedType,
      attachedId: schema.whiteboards.attachedId,
      editPermission: schema.whiteboards.editPermission,
      createdById: schema.whiteboards.createdById,
      sceneVersion: schema.whiteboards.sceneVersion,
      updatedAt: schema.whiteboards.updatedAt,
    })
    .from(schema.whiteboards)
    .where(and(eq(schema.whiteboards.meetingId, meeting.id), isNull(schema.whiteboards.deletedAt)));
  const whiteboards = wbRows.map((w) => ({ ...w, updatedAt: w.updatedAt.toISOString() }));

  // ── Health check ────────────────────────────────────────────────────────
  let health: HealthDTO | null = null;
  if (meeting.type === "healthCheck" && meeting.healthModelId) {
    const model = await getHealthModelFull(meeting.healthModelId);
    if (model) {
      const ratings = await db.select().from(schema.healthRatings).where(eq(schema.healthRatings.meetingId, meeting.id));
      const sIdx = stepIdx(meeting, "healthSurvey");
      const revealed = closed || meeting.stepIndex > sIdx;
      const anon = meeting.options.healthAnonymous !== false;
      const range = model.maxRating - model.minRating + 1;
      // previous health check with the same model
      const prev = await db
        .select({ id: schema.meetings.id })
        .from(schema.meetings)
        .where(
          and(
            eq(schema.meetings.teamId, team.id),
            eq(schema.meetings.type, "healthCheck"),
            eq(schema.meetings.healthModelId, model.id),
            isNull(schema.meetings.deletedAt),
            eq(schema.meetings.isDemo, false),
            lt(schema.meetings.createdAt, meeting.createdAt),
          ),
        )
        .orderBy(desc(schema.meetings.createdAt))
        .limit(1);
      const previous: Record<string, number | null> = {};
      if (prev[0]) {
        const prevRatings = await db.select().from(schema.healthRatings).where(eq(schema.healthRatings.meetingId, prev[0].id));
        for (const d of model.dimensions) {
          const vals = prevRatings.filter((r) => r.dimensionId === d.id && r.value !== null).map((r) => r.value!);
          previous[d.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        }
      }
      health = {
        model: {
          id: model.id,
          name: model.name,
          description: model.description,
          style: model.style,
          minRating: model.minRating,
          maxRating: model.maxRating,
          notApplicableOption: model.notApplicableOption,
          flipOrder: model.flipOrder,
          colors: model.colors,
          valueLabels: model.valueLabels,
          groups: model.groups.map((g) => ({ id: g.id, name: g.name, description: g.description })),
        },
        previous,
        dimensions: model.dimensions.map((d) => {
          const rs = ratings.filter((r) => r.dimensionId === d.id);
          const mineR = rs.find((r) => r.participantId === myP?.id);
          const vals = rs.filter((r) => r.value !== null && !r.notApplicable).map((r) => r.value!);
          const s = stats(vals);
          const distribution = Array.from({ length: range }, (_, i) => vals.filter((v) => v === model.minRating + i).length);
          const threshold = model.minRating + Math.ceil((range - 1) * 0.75);
          return {
            id: d.id,
            groupId: d.groupId,
            name: d.name,
            description: d.description,
            minLabel: d.minLabel,
            maxLabel: d.maxLabel,
            valueLabels: d.valueLabels,
            myRating: mineR ? { value: mineR.value, notApplicable: mineR.notApplicable, comment: mineR.comment } : null,
            results: revealed
              ? {
                  count: vals.length,
                  ...s,
                  score: vals.length ? Math.round((vals.filter((v) => v >= threshold).length / vals.length) * 100) : null,
                  distribution,
                  notApplicable: rs.filter((r) => r.notApplicable).length,
                  individual: rs.map((r) => ({ participantId: anon ? null : r.participantId, value: r.value })),
                  comments: rs
                    .filter((r) => r.comment.trim())
                    .map((r) => ({ participantId: anon ? null : r.participantId, name: anon ? null : nameOf(r.participantId), text: r.comment })),
                }
              : null,
          };
        }),
      };
    }
  }

  // ── Estimation ──────────────────────────────────────────────────────────
  let estimation: EstimationItemDTO[] = [];
  if (meeting.type === "estimation") {
    const items = await db.select().from(schema.estimationItems).where(eq(schema.estimationItems.meetingId, meeting.id)).orderBy(asc(schema.estimationItems.position));
    const evotes = await db.select().from(schema.estimationVotes).where(eq(schema.estimationVotes.meetingId, meeting.id));
    const cards = meeting.deck?.cards ?? [];
    estimation = items.map((it) => {
      const vs = evotes.filter((v) => v.itemId === it.id);
      const revealed = closed || it.phase === "review";
      const nums = vs.map((v) => cards.find((c) => c.label === v.value)?.value).filter((n): n is number => typeof n === "number");
      return {
        id: it.id,
        title: it.title,
        description: it.description,
        url: it.url,
        externalKey: it.externalKey,
        externalSource: it.externalSource,
        position: it.position,
        phase: it.phase as EstimationItemDTO["phase"],
        finalEstimate: it.finalEstimate,
        votedParticipantIds: vs.map((v) => v.participantId),
        votes: revealed ? vs.map((v) => ({ participantId: anonymity === "names" ? v.participantId : null, value: v.value })) : null,
        myVote: vs.find((v) => v.participantId === myP?.id)?.value ?? null,
        average: revealed && nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : null,
        syncStatus: it.syncStatus,
        commentCount: commentCount(it.id),
      };
    });
  }

  // ── Standup ─────────────────────────────────────────────────────────────
  let standup: StandupUpdateDTO[] = [];
  let standupCarryovers: MeetingStateDTO["standupCarryovers"] = [];
  let standupHiddenCount = 0;
  if (meeting.type === "standup") {
    const ups = await db.select().from(schema.standupUpdates).where(eq(schema.standupUpdates.meetingId, meeting.id)).orderBy(asc(schema.standupUpdates.position));
    const iFinished = !!myP?.finishedSteps.includes("standup");
    const showAll = closed || iFinished || me.isFacilitator || meeting.options.standupShowFeedBeforeFinish || myP?.role === "observer" || !myP;
    standupHiddenCount = showAll ? 0 : new Set(ups.filter((u) => u.userId !== viewer.id).map((u) => u.userId)).size;
    if (meeting.seriesId && myP) {
      const [prevMeeting] = await db
        .select({ id: schema.meetings.id, date: schema.meetings.date })
        .from(schema.meetings)
        .where(and(eq(schema.meetings.seriesId, meeting.seriesId), lt(schema.meetings.date, meeting.date), isNull(schema.meetings.deletedAt)))
        .orderBy(desc(schema.meetings.date))
        .limit(1);
      if (prevMeeting) {
        const prevUps = await db
          .select()
          .from(schema.standupUpdates)
          .where(and(eq(schema.standupUpdates.meetingId, prevMeeting.id), eq(schema.standupUpdates.userId, viewer.id), inArray(schema.standupUpdates.type, ["doing", "blocked"])));
        const carried = new Set(ups.filter((u) => u.carriedFromId).map((u) => u.carriedFromId));
        standupCarryovers = prevUps
          .filter((u) => !carried.has(u.id))
          .map((u) => ({ id: u.id, topicId: u.topicId, type: u.type, text: u.text, dayCount: u.dayCount, date: prevMeeting.date }));
      }
    }
    standup = ups
      .filter((u) => showAll || u.userId === viewer.id)
      .map((u) => ({
        id: u.id,
        participantId: u.participantId,
        userId: u.userId,
        topicId: u.topicId,
        type: u.type,
        text: u.text,
        position: u.position,
        carriedFromId: u.carriedFromId,
        carryStatus: u.carryStatus,
        dayCount: u.dayCount,
        mentions: u.mentions,
        reactions: reactionsFor(u.id),
        commentCount: commentCount(u.id),
        createdAt: u.createdAt.toISOString(),
      }));
  }

  // ── Live feedback ───────────────────────────────────────────────────────
  const liveRows = await db
    .select()
    .from(schema.liveEvents)
    .where(and(eq(schema.liveEvents.meetingId, meeting.id), or(eq(schema.liveEvents.active, true), gt(schema.liveEvents.createdAt, new Date(now - 12_000)))));
  const liveEvents = liveRows
    .filter((l) => l.kind === "reaction" ? now - l.createdAt.getTime() < 12_000 : l.active)
    .map((l) => ({ id: l.id, participantId: l.participantId, kind: l.kind, emoji: l.emoji, active: l.active, createdAt: l.createdAt.toISOString() }));

  // ── Check-in / check-out ────────────────────────────────────────────────
  const checks: CheckDTO[] = [];
  const checkRows = meeting.checkIn || meeting.checkOut ? await db.select().from(schema.checkResponses).where(eq(schema.checkResponses.meetingId, meeting.id)) : [];
  for (const kind of ["in", "out"] as const) {
    const state = kind === "in" ? meeting.checkIn : meeting.checkOut;
    if (!state?.question) continue;
    const rs = checkRows.filter((r) => r.kind === kind && r.question === state.question);
    checks.push({
      kind,
      question: state.question,
      revealed: state.revealed,
      myValue: rs.find((r) => r.participantId === myP?.id)?.value ?? null,
      responded: rs.length,
      distribution: state.revealed || closed ? [1, 2, 3, 4, 5].map((v) => rs.filter((r) => r.value === v).length) : null,
    });
  }

  // ── Icebreaker ──────────────────────────────────────────────────────────
  const iceRows = meeting.icebreaker?.gameKey
    ? await db.select().from(schema.icebreakerEntries).where(eq(schema.icebreakerEntries.meetingId, meeting.id)).orderBy(asc(schema.icebreakerEntries.createdAt))
    : [];
  // keep secret game data secret (imposter identity, two-truths lies)
  let icebreaker = meeting.icebreaker ?? null;
  if (icebreaker?.gameKey === "imposter" && icebreaker.phase !== "reveal" && icebreaker.data) {
    const { imposter, word, ...rest } = icebreaker.data as Record<string, unknown>;
    const amImposter = !!myP && imposter === myP.id;
    icebreaker = { ...icebreaker, data: { ...rest, word: amImposter ? undefined : word, youAreImposter: amImposter } };
  }
  const ibData = (icebreaker?.data ?? {}) as Record<string, unknown>;
  const revealedTarget = icebreaker?.gameKey === "twoTruths" && ibData.revealed ? (ibData.order as string[] | undefined)?.[Number(ibData.current ?? 0)] : null;
  const icebreakerEntries = iceRows.map((e) => ({
    id: e.id,
    participantId: e.participantId,
    round: e.round,
    kind: e.kind,
    payload:
      e.kind === "statements" && e.participantId !== myP?.id && e.participantId !== revealedTarget
        ? withoutLie(e.payload as Record<string, unknown>)
        : e.payload,
    mine: e.participantId === myP?.id,
    createdAt: e.createdAt.toISOString(),
  }));

  // ── Stats ───────────────────────────────────────────────────────────────
  const expected = pRows.filter(({ p }) => ["facilitator", "participant", "guest"].includes(p.role) && !(p.absent)).length;
  const contributorsSet = new Set<string>();
  if (meeting.type === "retrospective") ideaRows.forEach((i) => contributorsSet.add(i.participantId));
  if (meeting.type === "healthCheck") (await db.select({ p: schema.healthRatings.participantId }).from(schema.healthRatings).where(eq(schema.healthRatings.meetingId, meeting.id))).forEach((r) => contributorsSet.add(r.p));
  if (meeting.type === "estimation") (await db.select({ p: schema.estimationVotes.participantId }).from(schema.estimationVotes).where(eq(schema.estimationVotes.meetingId, meeting.id))).forEach((r) => contributorsSet.add(r.p));
  if (meeting.type === "standup") standup.forEach((u) => contributorsSet.add(u.participantId));
  const votedTargets = new Set(voteRows.map((v) => v.targetId));

  return {
    serverNow: new Date().toISOString(),
    version: meeting.version,
    meeting: {
      id: meeting.id,
      teamId: meeting.teamId,
      seriesId: meeting.seriesId,
      type: meeting.type as MeetingStateDTO["meeting"]["type"],
      title: meeting.title,
      date: meeting.date,
      status: meeting.status as "open" | "closed",
      anonymity,
      stepIndex: meeting.stepIndex,
      steps: meeting.steps,
      options: meeting.options,
      topics: meeting.topics,
      context: meeting.context,
      contextImageUrl: mediaUrl(meeting.contextMediaId),
      templateName: meeting.templateName,
      timer: meeting.timer ?? null,
      presenting: meeting.presenting ?? null,
      checkIn: meeting.checkIn ?? null,
      checkOut: meeting.checkOut ?? null,
      icebreaker,
      notes: meeting.notes,
      aiSummary: meeting.aiSummary,
      collectingUntil: meeting.collectingUntil?.toISOString() ?? null,
      deck: meeting.deck ?? null,
      healthModelId: meeting.healthModelId,
      createdAt: meeting.createdAt.toISOString(),
      closedAt: meeting.closedAt?.toISOString() ?? null,
      isDemo: meeting.isDemo,
    },
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
      orgId: team.orgId,
      orgSlug: org.slug,
      logoUrl: mediaUrl(team.logoMediaId),
      aiEnabled: org.settings?.aiEnabled !== false && !!process.env.ANTHROPIC_API_KEY,
    },
    me,
    participants,
    members,
    ideas,
    hiddenIdeaCounts,
    groups,
    comments,
    chat,
    actions,
    kudos,
    whiteboards,
    polls,
    health,
    estimation,
    standup,
    standupCarryovers,
    standupHiddenCount,
    liveEvents,
    checks,
    icebreakerEntries,
    voting: { maxVotes: unlimited ? null : maxVotes, used: myUsed, remaining: unlimited ? null : Math.max(0, (maxVotes ?? 0) - myUsed) },
    stats: {
      ideas: ideaRows.length,
      ideaContributors: new Set(ideaRows.map((i) => i.participantId)).size,
      votesCast: voteRows.reduce((a, v) => a + v.count, 0),
      votedTargets: votedTargets.size,
      voters: new Set(voteRows.map((v) => v.participantId)).size,
      participationRate: expected ? Math.round((Math.min(contributorsSet.size, expected) / expected) * 100) : 0,
      contributors: contributorsSet.size,
      expected,
    },
  };
}

export function toActionDTO(
  a: typeof schema.actionItems.$inferSelect,
  memberMap: Map<string, typeof schema.users.$inferSelect>,
  voteRows: (typeof schema.actionVotes.$inferSelect)[],
  commentCounts: { targetId: string; n: number }[],
  viewerId: string,
): ActionDTO {
  const vs = voteRows.filter((v) => v.actionId === a.id);
  return {
    id: a.id,
    teamId: a.teamId,
    meetingId: a.meetingId,
    kind: a.kind as ActionDTO["kind"],
    title: a.title,
    description: a.description,
    status: a.status,
    assigneeIds: a.assigneeIds,
    assignees: a.assigneeIds
      .map((id) => memberMap.get(id))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, name: u!.name, color: u!.color, avatarUrl: mediaUrl(u!.avatarMediaId) })),
    dueDate: a.dueDate,
    priority: a.priority,
    sourceType: a.sourceType,
    sourceId: a.sourceId,
    sourceText: a.sourceText,
    sourceMeetingTitle: a.sourceMeetingTitle,
    ai: a.ai,
    published: a.published,
    position: a.position,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    votes: {
      agree: vs.filter((v) => v.value === "agree").length,
      neutral: vs.filter((v) => v.value === "neutral").length,
      disagree: vs.filter((v) => v.value === "disagree").length,
      mine: vs.find((v) => v.userId === viewerId)?.value ?? null,
    },
    commentCount: commentCounts.find((c) => c.targetId === a.id)?.n ?? 0,
    mine: a.createdById === viewerId,
  };
}

function withoutLie(payload: Record<string, unknown>) {
  const rest = { ...payload };
  delete rest.lie;
  return rest;
}
