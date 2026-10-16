import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { CurrentUser } from "./auth";

export type ChecklistItem = { key: string; label: string; done: boolean; href: string; cta: string };

const dismissed = (user: CurrentUser) => new Set(((user.options as { dismissedTips?: string[] })?.dismissedTips ?? []) as string[]);

/** Org admins' setup checklist. */
export async function orgChecklist(user: CurrentUser, org: { id: string; slug: string }): Promise<ChecklistItem[]> {
  const [{ admins }] = await db
    .select({ admins: sql<number>`count(*)::int` })
    .from(schema.orgUsers)
    .where(and(eq(schema.orgUsers.orgId, org.id), eq(schema.orgUsers.active, true), sql`${schema.orgUsers.roles} && ARRAY['admin','owner']::text[]`));
  const [{ teams }] = await db.select({ teams: sql<number>`count(*)::int` }).from(schema.teams).where(and(eq(schema.teams.orgId, org.id), isNull(schema.teams.deletedAt)));
  const skip = dismissed(user);
  return [
    { key: `org:${org.id}:admin`, label: "Add another organization admin", done: admins > 1, href: `/o/${org.slug}/users`, cta: "Add" },
    { key: `org:${org.id}:team`, label: "Create a second team", done: teams > 1, href: `/o/${org.slug}/teams`, cta: "Create" },
  ].filter((i) => !skip.has(i.key));
}

/** Team admins' setup checklist. */
export async function teamChecklist(user: CurrentUser, teamId: string): Promise<ChecklistItem[]> {
  const [{ members }] = await db.select({ members: sql<number>`count(*)::int` }).from(schema.members).where(eq(schema.members.teamId, teamId));
  const types = await db
    .selectDistinct({ type: schema.meetings.type })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.teamId, teamId), eq(schema.meetings.isDemo, false), isNull(schema.meetings.deletedAt), inArray(schema.meetings.type, ["retrospective", "healthCheck", "standup", "estimation"])));
  const has = new Set(types.map((t) => t.type));
  const [integration] = await db.select({ id: schema.integrations.id }).from(schema.integrations).where(eq(schema.integrations.teamId, teamId)).limit(1);
  const base = `/t/${teamId}`;
  const skip = dismissed(user);
  return [
    { key: `team:${teamId}:invite`, label: "Invite your team", done: members > 1, href: `${base}/members`, cta: "Invite" },
    { key: `team:${teamId}:retrospective`, label: "Run a retrospective with your team", done: has.has("retrospective"), href: `${base}/retrospectives`, cta: "Start" },
    { key: `team:${teamId}:healthCheck`, label: "Run a health check with your team", done: has.has("healthCheck"), href: `${base}/health-checks`, cta: "Start" },
    { key: `team:${teamId}:standup`, label: "Run a standup with your team", done: has.has("standup"), href: `${base}/standups`, cta: "Start" },
    { key: `team:${teamId}:estimation`, label: "Run an estimation with your team", done: has.has("estimation"), href: `${base}/estimations`, cta: "Start" },
    { key: `team:${teamId}:integrations`, label: "Configure your integrations", done: !!integration, href: `${base}/settings/integrations`, cta: "Configure" },
  ].filter((i) => !skip.has(i.key));
}
