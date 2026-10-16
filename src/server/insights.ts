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
