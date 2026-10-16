import "server-only";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { bus, emitTeamChange } from "./realtime";

/** Bump every open meeting in a team so team-level panels (actions, agreements…) refresh live. */
export async function bumpTeamMeetings(teamId: string, exceptMeetingId?: string) {
  const rows = await db
    .update(schema.meetings)
    .set({ version: sql`${schema.meetings.version} + 1` })
    .where(
      and(
        eq(schema.meetings.teamId, teamId),
        eq(schema.meetings.status, "open"),
        isNull(schema.meetings.deletedAt),
        exceptMeetingId ? ne(schema.meetings.id, exceptMeetingId) : undefined,
      ),
    )
    .returning({ id: schema.meetings.id, version: schema.meetings.version });
  for (const r of rows) bus.emit(`meeting:${r.id}`, r.version);
  emitTeamChange(teamId);
}
