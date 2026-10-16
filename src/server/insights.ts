import "server-only";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
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
