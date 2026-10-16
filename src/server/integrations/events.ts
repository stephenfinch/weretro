import "server-only";
import { createHmac } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";

export const WEBHOOK_EVENTS = [
  "meeting.created",
  "meeting.closed",
  "meeting.reopened",
  "action.created",
  "action.updated",
  "action.completed",
  "agreement.created",
  "kudos.given",
  "standup.update",
  "health.submitted",
] as const;

/** Fire-and-forget event delivery to webhook-style integrations (webhook, n8n, Zapier). */
export async function dispatchEvent(teamId: string, event: string, payload: Record<string, unknown>) {
  try {
    const hooks = await db
      .select()
      .from(schema.integrations)
      .where(and(eq(schema.integrations.teamId, teamId), inArray(schema.integrations.type, ["webhook", "n8n", "zapier"]), eq(schema.integrations.status, "active")));
    for (const hook of hooks) {
      const url = hook.config.url;
      if (!url) continue;
      const events = (hook.config.events ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (events.length && !events.includes(event) && !events.includes("*")) continue;
      const body = JSON.stringify({ event, teamId, occurredAt: new Date().toISOString(), data: payload });
      const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "WeRetro-Webhooks/1.0" };
      if (hook.config.secret) headers["x-weretro-signature"] = createHmac("sha256", hook.config.secret).update(body).digest("hex");
      try {
        const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(8000) });
        await db.insert(schema.integrationLogs).values({ integrationId: hook.id, event, status: res.ok ? "ok" : "error", message: `HTTP ${res.status}` });
      } catch (e) {
        await db.insert(schema.integrationLogs).values({ integrationId: hook.id, event, status: "error", message: String(e) });
      }
    }
  } catch (e) {
    console.error("dispatchEvent failed", e);
  }
}
