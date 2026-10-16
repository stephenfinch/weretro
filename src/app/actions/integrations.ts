"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser, randomToken, sha256 } from "@/server/auth";
import { assertTeamAccess, getOrgAccess, HttpError } from "@/server/access";
import { publishActions, publishAgreements, publishSummary, syncEstimate, testIntegration, undoPublish, searchIssues } from "@/server/integrations/publish";
import { integrationDef } from "@/lib/integrations";
import { meetingMarkdown } from "@/server/exports";
import { bumpTeamMeetings } from "@/server/team-events";

type Result<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };
async function wrap<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

async function requireTeamAdmin(teamId: string) {
  const user = await requireUser();
  const access = await assertTeamAccess(user, teamId);
  if (!access.isAdmin) throw new HttpError(403, "Team admin role required");
  return { user, access };
}

export async function saveIntegration(teamId: string, input: { id?: string; type: string; name?: string; config: Record<string, string> }) {
  return wrap(async () => {
    const { user } = await requireTeamAdmin(teamId);
    const def = integrationDef(input.type);
    if (!def) throw new HttpError(400, "Unknown integration");
    let config = input.config;
    if (input.id) {
      const [existing] = await db.select().from(schema.integrations).where(and(eq(schema.integrations.id, input.id), eq(schema.integrations.teamId, teamId))).limit(1);
      if (!existing) throw new HttpError(404, "Not found");
      // keep secrets that were left blank
      config = Object.fromEntries(def.fields.map((f) => [f.key, input.config[f.key] || (f.secret ? existing.config[f.key] : "") || ""]));
      await db.update(schema.integrations).set({ config, name: input.name ?? existing.name, status: "active", lastError: null }).where(eq(schema.integrations.id, input.id));
    } else {
      for (const f of def.fields) if (!f.optional && !config[f.key]) throw new HttpError(400, `${f.label} is required`);
      await db.insert(schema.integrations).values({ teamId, type: input.type, name: input.name ?? def.name, config, createdById: user.id });
    }
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function deleteIntegration(teamId: string, id: string) {
  return wrap(async () => {
    await requireTeamAdmin(teamId);
    await db.delete(schema.integrations).where(and(eq(schema.integrations.id, id), eq(schema.integrations.teamId, teamId)));
    revalidatePath(`/t/${teamId}`, "layout");
  });
}

export async function testIntegrationAction(teamId: string, id: string) {
  return wrap(async () => {
    await requireTeamAdmin(teamId);
    const [i] = await db.select().from(schema.integrations).where(and(eq(schema.integrations.id, id), eq(schema.integrations.teamId, teamId))).limit(1);
    if (!i) throw new HttpError(404, "Not found");
    const r = await testIntegration(i);
    if (!r.ok) throw new HttpError(502, r.error ?? "Connection failed");
    revalidatePath(`/t/${teamId}/settings/integrations`);
  });
}

export async function integrationLogs(teamId: string, id: string) {
  const user = await requireUser();
  await assertTeamAccess(user, teamId);
  return db.select().from(schema.integrationLogs).where(eq(schema.integrationLogs.integrationId, id)).orderBy(desc(schema.integrationLogs.createdAt)).limit(50);
}

export async function publishActionsAction(teamId: string, integrationId: string, actionIds: string[]) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId, "manageActions");
    const r = await publishActions(teamId, integrationId, actionIds);
    await bumpTeamMeetings(teamId);
    revalidatePath(`/t/${teamId}`);
    const failed = r.filter((x) => !x.ok);
    if (failed.length) throw new HttpError(502, `${failed.length} failed: ${failed[0].error}`);
    return r;
  });
}

export async function undoPublishAction(teamId: string, actionId: string, integrationId: string) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId, "manageActions");
    await undoPublish(teamId, actionId, integrationId);
    await bumpTeamMeetings(teamId);
    revalidatePath(`/t/${teamId}`);
  });
}

export async function publishAgreementsAction(teamId: string, integrationId: string) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId);
    await publishAgreements(teamId, integrationId);
  });
}

export async function publishSummaryAction(teamId: string, integrationId: string, meetingId: string) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId);
    const { markdown, title } = await meetingMarkdown(meetingId, user.id);
    await publishSummary(teamId, integrationId, meetingId, markdown, title);
  });
}

export async function syncEstimatesAction(teamId: string, itemIds: string[]) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId);
    const results = [];
    for (const id of itemIds) results.push({ id, ...(await syncEstimate(id)) });
    return results;
  });
}

export async function searchIssuesAction(teamId: string, type: string, query: { text?: string; jql?: string; wiql?: string; unestimatedOnly?: boolean }) {
  return wrap(async () => {
    const user = await requireUser();
    await assertTeamAccess(user, teamId);
    return searchIssues(teamId, type, query);
  });
}

// ── API keys ──────────────────────────────────────────────────────────────

export async function createApiKey(input: { orgId: string; teamId?: string | null; name: string; scopes: string[] }) {
  return wrap(async () => {
    const user = await requireUser();
    if (input.teamId) {
      const access = await assertTeamAccess(user, input.teamId);
      if (!access.isAdmin) throw new HttpError(403, "Team admin role required");
      if (access.org.settings?.teamApiKeys === false) throw new HttpError(403, "Team API keys are disabled for this organization");
    } else {
      const org = await getOrgAccess(user, input.orgId);
      if (!org?.isAdmin) throw new HttpError(403, "Organization admin role required");
    }
    const scopes = input.scopes.filter((s) => ["read", "write", "scim"].includes(s));
    if (!scopes.length) throw new HttpError(400, "Choose at least one scope");
    const secret = `wr_${randomToken(30)}`;
    await db.insert(schema.apiKeys).values({ orgId: input.orgId, teamId: input.teamId ?? null, name: input.name || "API key", prefix: secret.slice(0, 10), keyHash: sha256(secret), scopes, createdById: user.id });
    revalidatePath("/", "layout");
    return { secret };
  });
}

export async function revokeApiKey(id: string) {
  return wrap(async () => {
    const user = await requireUser();
    const [k] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);
    if (!k) throw new HttpError(404, "Not found");
    if (k.teamId) {
      const access = await assertTeamAccess(user, k.teamId);
      if (!access.isAdmin) throw new HttpError(403, "Team admin role required");
    } else {
      const org = await getOrgAccess(user, k.orgId);
      if (!org?.isAdmin) throw new HttpError(403, "Organization admin role required");
    }
    await db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(eq(schema.apiKeys.id, id));
    revalidatePath("/", "layout");
  });
}

export async function listTeamIntegrations(teamIds: string[]) {
  if (!teamIds.length) return [];
  return db.select({ id: schema.integrations.id, type: schema.integrations.type, name: schema.integrations.name, teamId: schema.integrations.teamId }).from(schema.integrations).where(inArray(schema.integrations.teamId, teamIds));
}
