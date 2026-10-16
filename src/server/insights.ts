import "server-only";
import { and, asc, eq, gte, inArray, isNull, lte, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db";

export async function healthHistoryRows(teamId: string, modelId: string | null) {
  const rows: (string | number | null)[][] = [["Date", "Health check", "Dimension", "Mean", "Responses"]];
  if (!modelId) return rows;
  const meetings = await db
    .select()
    .from(schema.meetings)
    .where(and(eq(schema.meetings.teamId, teamId), eq(schema.meetings.healthModelId, modelId), isNull(schema.meetings.deletedAt)))
    .orderBy(asc(schema.meetings.date));
  if (!meetings.length) return rows;
  const dims = await db.select().from(schema.healthDimensions).where(eq(schema.healthDimensions.modelId, modelId));
  const ratings = await db.select().from(schema.healthRatings).where(inArray(schema.healthRatings.meetingId, meetings.map((m) => m.id)));
  for (const m of meetings)
    for (const d of dims) {
      const vals = ratings.filter((r) => r.meetingId === m.id && r.dimensionId === d.id && r.value !== null).map((r) => r.value!);
      rows.push([m.date, m.title, d.name, vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null, vals.length]);
    }
  return rows;
}

export async function healthHistory(teamIds: string[], modelId: string) {
  if (!teamIds.length) return { dimensions: [], points: [] as { date: string; meetingId: string; teamId: string; values: Record<string, number | null>; overall: number | null; responses: number }[] };
  const meetings = await db
    .select()
    .from(schema.meetings)
    .where(and(inArray(schema.meetings.teamId, teamIds), eq(schema.meetings.healthModelId, modelId), isNull(schema.meetings.deletedAt)))
    .orderBy(asc(schema.meetings.date));
  const dims = await db.select().from(schema.healthDimensions).where(and(eq(schema.healthDimensions.modelId, modelId), isNull(schema.healthDimensions.deletedAt))).orderBy(asc(schema.healthDimensions.position));
  const ratings = meetings.length ? await db.select().from(schema.healthRatings).where(inArray(schema.healthRatings.meetingId, meetings.map((m) => m.id))) : [];
  const points = meetings.map((m) => {
    const values: Record<string, number | null> = {};
    const all: number[] = [];
    for (const d of dims) {
      const vals = ratings.filter((r) => r.meetingId === m.id && r.dimensionId === d.id && r.value !== null).map((r) => r.value!);
      values[d.id] = vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      all.push(...vals);
    }
    return { date: m.date, meetingId: m.id, teamId: m.teamId, values, overall: all.length ? +(all.reduce((a, b) => a + b, 0) / all.length).toFixed(2) : null, responses: new Set(ratings.filter((r) => r.meetingId === m.id).map((r) => r.participantId)).size };
  });
  return { dimensions: dims.map((d) => ({ id: d.id, name: d.name })), points: points.filter((p) => p.overall !== null) };
}

// ── Insights dashboards ───────────────────────────────────────────────────

const STOP = new Set("a an and are as at be been but by can could did do does for from had has have how i if in into is it its just more most much my need needs no not of on or our out so some than that the their them then there these they this to too up us very was we were what when which who why will with would you your should get got really make made lot lots also still all any been being over very well".split(" "));
const POS = new Set("good great love awesome happy smooth fast improved better best helpful fun proud win wins success successful easy nice clear collaboration teamwork thanks thank excellent celebrate shipped delivered support enjoyed amazing".split(" "));
const NEG = new Set("bad slow broken bug bugs blocked blocker late delay delays hard difficult problem problems issue issues confusing unclear stress stressful tired frustrating frustrated missing lack lacking poor worse worst fail failed failing crash debt overload meetings interruptions".split(" "));

export function lexSentiment(text: string) {
  let s = 0;
  for (const w of text.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (POS.has(w)) s++;
    if (NEG.has(w)) s--;
  }
  return Math.max(-4, Math.min(4, s));
}

export type InsightsScope = { teamIds: string[]; from: Date; to: Date };

export async function insightsData({ teamIds, from, to }: InsightsScope) {
  const empty = !teamIds.length;
  const inScope = (col: typeof schema.meetings.teamId) => (empty ? dsql`false` : inArray(col, teamIds));
  const meetings = await db
    .select()
    .from(schema.meetings)
    .where(and(inScope(schema.meetings.teamId), isNull(schema.meetings.deletedAt), eq(schema.meetings.isDemo, false), gte(schema.meetings.createdAt, from), lte(schema.meetings.createdAt, to)))
    .orderBy(asc(schema.meetings.date));
  const ids = meetings.map((m) => m.id);
  const teams = empty ? [] : await db.select({ id: schema.teams.id, name: schema.teams.name, color: schema.teams.color }).from(schema.teams).where(inArray(schema.teams.id, teamIds));
  const ideas = ids.length ? await db.select({ id: schema.ideas.id, text: schema.ideas.text, meetingId: schema.ideas.meetingId, topicId: schema.ideas.topicId, participantId: schema.ideas.participantId }).from(schema.ideas).where(inArray(schema.ideas.meetingId, ids)) : [];
  const participants = ids.length ? await db.select({ meetingId: schema.participants.meetingId, userId: schema.participants.userId, role: schema.participants.role, joinedAt: schema.participants.joinedAt, absent: schema.participants.absent }).from(schema.participants).where(inArray(schema.participants.meetingId, ids)) : [];
  const actions = empty
    ? []
    : await db.select().from(schema.actionItems).where(and(inArray(schema.actionItems.teamId, teamIds), isNull(schema.actionItems.deletedAt), gte(schema.actionItems.createdAt, from), lte(schema.actionItems.createdAt, to)));
  const openActions = empty ? [] : await db.select().from(schema.actionItems).where(and(inArray(schema.actionItems.teamId, teamIds), isNull(schema.actionItems.deletedAt), eq(schema.actionItems.kind, "action"), eq(schema.actionItems.status, "accepted")));
  const agreements = empty ? [] : await db.select().from(schema.actionItems).where(and(inArray(schema.actionItems.teamId, teamIds), isNull(schema.actionItems.deletedAt), eq(schema.actionItems.kind, "agreement"), eq(schema.actionItems.status, "accepted")));
  const checks = ids.length ? await db.select().from(schema.checkResponses).where(inArray(schema.checkResponses.meetingId, ids)) : [];
  const estItems = ids.length ? await db.select().from(schema.estimationItems).where(inArray(schema.estimationItems.meetingId, ids)) : [];
  const kudosRows = empty ? [] : await db.select().from(schema.kudos).where(and(inArray(schema.kudos.teamId, teamIds), gte(schema.kudos.createdAt, from)));
  const commentCount = ids.length ? (await db.select({ n: dsql<number>`count(*)::int` }).from(schema.comments).where(inArray(schema.comments.meetingId, ids)))[0].n : 0;
  const reactionCount = ids.length ? (await db.select({ n: dsql<number>`count(*)::int` }).from(schema.reactions).where(inArray(schema.reactions.meetingId, ids)))[0].n : 0;
  const pollCount = ids.length ? (await db.select({ n: dsql<number>`count(*)::int` }).from(schema.polls).where(inArray(schema.polls.meetingId, ids)))[0].n : 0;
  const wbCount = ids.length ? (await db.select({ n: dsql<number>`count(*)::int` }).from(schema.whiteboards).where(inArray(schema.whiteboards.meetingId, ids)))[0].n : 0;
  const updates = ids.length ? await db.select({ meetingId: schema.standupUpdates.meetingId, type: schema.standupUpdates.type }).from(schema.standupUpdates).where(inArray(schema.standupUpdates.meetingId, ids)) : [];

  const month = (d: Date | string) => (typeof d === "string" ? d : d.toISOString()).slice(0, 7);
  const months = [...new Set(meetings.map((m) => m.date.slice(0, 7)))].sort();
  const byType = (t: string) => meetings.filter((m) => m.type === t);

  // participation: contributors / expected per meeting
  const participation = meetings.map((m) => {
    const ps = participants.filter((p) => p.meetingId === m.id && ["facilitator", "participant", "guest"].includes(p.role) && !p.absent);
    const joined = ps.filter((p) => p.joinedAt).length;
    return ps.length ? joined / ps.length : 0;
  });
  const avgParticipation = participation.length ? Math.round((participation.reduce((a, b) => a + b, 0) / participation.length) * 100) : 0;

  const completed = actions.filter((a) => a.kind === "action" && a.completedAt);
  const avgDays = completed.length ? Math.round(completed.reduce((a, x) => a + (x.completedAt!.getTime() - x.createdAt.getTime()) / 86400000, 0) / completed.length) : null;

  // retro frequency per team
  const retroFreq = teams.map((t) => {
    const ds = byType("retrospective").filter((m) => m.teamId === t.id).map((m) => new Date(m.date).getTime()).sort((a, b) => a - b);
    const gaps = ds.slice(1).map((d, i) => (d - ds[i]) / 86400000).sort((a, b) => a - b);
    const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : null;
    const label = med === null ? (ds.length ? "Ad-Hoc" : "None") : med <= 8 ? "Every week" : med <= 15 ? "Every two weeks" : med <= 22 ? "Every three weeks" : med <= 35 ? "Monthly" : med <= 100 ? "Quarterly" : "Ad-Hoc";
    return { team: t.name, count: ds.length, label };
  });

  const templateUse = Object.entries(byType("retrospective").reduce<Record<string, number>>((acc, m) => ((acc[m.templateName ?? "Custom"] = (acc[m.templateName ?? "Custom"] ?? 0) + 1), acc), {}))
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const wordCounts = new Map<string, { n: number; s: number }>();
  for (const i of ideas) {
    const s = lexSentiment(i.text);
    for (const w of i.text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (STOP.has(w)) continue;
      const cur = wordCounts.get(w) ?? { n: 0, s: 0 };
      cur.n++;
      cur.s += s;
      wordCounts.set(w, cur);
    }
  }
  const words = [...wordCounts.entries()].map(([text, v]) => ({ text, value: v.n, sentiment: v.s / v.n })).sort((a, b) => b.value - a.value).slice(0, 60);

  const sentimentTrend = byType("retrospective").map((m) => {
    const list = ideas.filter((i) => i.meetingId === m.id);
    const scores = list.map((i) => lexSentiment(i.text));
    const pos = scores.filter((s) => s > 0).length;
    const neg = scores.filter((s) => s < 0).length;
    return { date: m.date, team: teams.find((t) => t.id === m.teamId)?.name ?? "", positive: pos, negative: neg, neutral: scores.length - pos - neg, avg: scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0 };
  });

  const checkStats = Object.entries(
    checks.reduce<Record<string, number[]>>((acc, c) => {
      (acc[`${c.kind}:${c.question}`] ??= [0, 0, 0, 0, 0])[c.value - 1]++;
      return acc;
    }, {}),
  ).map(([k, dist]) => ({ kind: k.split(":")[0], question: k.split(":")[1], dist }));

  const activity = months.map((mo) => ({
    month: mo,
    retrospective: meetings.filter((m) => m.type === "retrospective" && m.date.startsWith(mo)).length,
    healthCheck: meetings.filter((m) => m.type === "healthCheck" && m.date.startsWith(mo)).length,
    estimation: meetings.filter((m) => m.type === "estimation" && m.date.startsWith(mo)).length,
    standup: meetings.filter((m) => m.type === "standup" && m.date.startsWith(mo)).length,
  }));

  const actionMonths = [...new Set([...actions.map((a) => month(a.createdAt)), ...completed.map((a) => month(a.completedAt!))])].sort();
  const actionTrend = actionMonths.map((mo) => ({
    month: mo,
    created: actions.filter((a) => a.kind === "action" && month(a.createdAt) === mo).length,
    completed: completed.filter((a) => month(a.completedAt!) === mo).length,
  }));

  const activityByTeam = teams.map((t) => ({
    team: t.name,
    color: t.color,
    meetings: meetings.filter((m) => m.teamId === t.id).length,
    retros: meetings.filter((m) => m.teamId === t.id && m.type === "retrospective").length,
    health: meetings.filter((m) => m.teamId === t.id && m.type === "healthCheck").length,
    estimations: meetings.filter((m) => m.teamId === t.id && m.type === "estimation").length,
    standups: meetings.filter((m) => m.teamId === t.id && m.type === "standup").length,
    openActions: openActions.filter((a) => a.teamId === t.id).length,
    agreements: agreements.filter((a) => a.teamId === t.id).length,
    last: meetings.filter((m) => m.teamId === t.id).at(-1)?.date ?? null,
  }));

  const activeUsers = new Set(participants.filter((p) => p.joinedAt).map((p) => p.userId)).size;

  return {
    teams,
    key: {
      teams: teams.length,
      users: activeUsers,
      retrospectives: byType("retrospective").length,
      healthChecks: byType("healthCheck").length,
      estimations: byType("estimation").length,
      standups: byType("standup").length,
      ideas: ideas.length,
      actionsCreated: actions.filter((a) => a.kind === "action").length,
      actionsCompleted: completed.length,
      actionsPublished: actions.filter((a) => a.published.length).length,
      openActions: openActions.length,
      agreements: agreements.length,
      participationRate: avgParticipation,
      timeToCompletion: avgDays,
      ideasPerRetro: byType("retrospective").length ? Math.round(ideas.length / byType("retrospective").length) : 0,
      estimatedItems: estItems.filter((e) => e.finalEstimate).length,
    },
    activity,
    activityByTeam,
    retroFreq,
    templateUse,
    words,
    sentimentTrend,
    checkStats,
    actionTrend,
    openActionsList: openActions.slice(0, 50).map((a) => ({ id: a.id, title: a.title, team: teams.find((t) => t.id === a.teamId)?.name ?? "", dueDate: a.dueDate, createdAt: a.createdAt.toISOString().slice(0, 10) })),
    agreementsList: agreements.slice(0, 50).map((a) => ({ id: a.id, title: a.title, team: teams.find((t) => t.id === a.teamId)?.name ?? "", createdAt: a.createdAt.toISOString().slice(0, 10) })),
    estimations: byType("estimation").map((m) => ({ date: m.date, team: teams.find((t) => t.id === m.teamId)?.name ?? "", title: m.title, items: estItems.filter((e) => e.meetingId === m.id).length, estimated: estItems.filter((e) => e.meetingId === m.id && e.finalEstimate).length })),
    usage: { comments: commentCount, reactions: reactionCount, polls: pollCount, whiteboards: wbCount, kudos: kudosRows.length, standupUpdates: updates.length, blockers: updates.filter((u) => u.type === "blocked").length },
    healthModels: [...new Set(byType("healthCheck").map((m) => m.healthModelId).filter(Boolean))] as string[],
  };
}
export type InsightsData = Awaited<ReturnType<typeof insightsData>>;

export async function latestHealthByTeam(teamIds: string[], modelId: string) {
  const h = await healthHistory(teamIds, modelId);
  const latest = new Map<string, (typeof h.points)[number]>();
  for (const p of h.points) latest.set(p.teamId, p);
  return { dimensions: h.dimensions, rows: [...latest.values()] };
}
