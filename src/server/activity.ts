import "server-only";
import { db, schema } from "@/db";

export async function logActivity(entry: {
  orgId: string;
  teamId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}) {
  try {
    await db.insert(schema.activityLog).values({
      orgId: entry.orgId,
      teamId: entry.teamId ?? null,
      userId: entry.userId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      data: entry.data ?? {},
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}
