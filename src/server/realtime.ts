import "server-only";
import { EventEmitter } from "node:events";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Realtime model: every meeting row carries a monotonically increasing `version`.
 * Any mutation bumps it. Clients long-poll `/api/meetings/:id/state?v=<version>`
 * and get a fresh snapshot as soon as the version moves. Within one server process
 * waiters are woken instantly via an EventEmitter; across processes (serverless)
 * the long-poll loop re-checks the database every second.
 */
const g = globalThis as unknown as { __wrBus?: EventEmitter };
export const bus: EventEmitter = g.__wrBus ?? (g.__wrBus = new EventEmitter());
bus.setMaxListeners(0);

export async function bumpVersion(meetingId: string) {
  const rows = await db
    .update(schema.meetings)
    .set({ version: sql`${schema.meetings.version} + 1` })
    .where(eq(schema.meetings.id, meetingId))
    .returning({ version: schema.meetings.version });
  const v = rows[0]?.version ?? 0;
  bus.emit(`meeting:${meetingId}`, v);
  return v;
}

export async function getVersion(meetingId: string) {
  const rows = await db.select({ version: schema.meetings.version }).from(schema.meetings).where(eq(schema.meetings.id, meetingId)).limit(1);
  return rows[0]?.version ?? null;
}

/** Wait until the meeting version differs from `since`, or until timeout. Returns the current version. */
export async function waitForChange(meetingId: string, since: number, timeoutMs: number, signal?: AbortSignal) {
  const current = await getVersion(meetingId);
  if (current === null || current !== since) return current;
  return new Promise<number | null>((resolve) => {
    let done = false;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      bus.off(`meeting:${meetingId}`, onBump);
      signal?.removeEventListener("abort", onAbort);
      resolve(v);
    };
    const onBump = (v: number) => {
      if (v !== since) finish(v);
    };
    const onAbort = () => finish(since);
    const poll = setInterval(async () => {
      try {
        const v = await getVersion(meetingId);
        if (v !== since) finish(v);
      } catch {
        /* ignore transient errors */
      }
    }, 1000);
    const timer = setTimeout(() => finish(since), timeoutMs);
    bus.on(`meeting:${meetingId}`, onBump);
    signal?.addEventListener("abort", onAbort);
  });
}

/** Team-level change feed (actions, agreements, meetings list). */
export function emitTeamChange(teamId: string) {
  bus.emit(`team:${teamId}`, Date.now());
}
