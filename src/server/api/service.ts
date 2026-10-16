import "server-only";
import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { sha256, type CurrentUser } from "../auth";
import { HttpError } from "../access";
import { updateActionItem } from "../meetings/ops";
import { createMeeting } from "../meetings/create";
import { loadMeetingContext } from "../meetings/context";
import { buildMeetingState } from "../meetings/state";
import { stateToMarkdown } from "../exports";
import { healthHistory } from "../insights";
import { bumpTeamMeetings } from "../team-events";
import { dispatchEvent } from "../integrations/events";
import type { MeetingType } from "@/lib/types";

/**
 * Shared implementation behind the REST API (/api/v1), the MCP server (/api/mcp)
 * and SCIM. Every call is made on behalf of an API key; team keys see one team,
 * account keys see every team in the organization.
 */

export type Principal = {
  /** "key": an API key (acts as its creator, limited to a team for team keys). "oauth": an app a person connected. */
  via: "key" | "oauth";
  id: string;
  teamId: string | null;
  scopes: string[];
  org: typeof schema.organizations.$inferSelect;
  user: CurrentUser;
};

export const OAUTH_TOKEN_PREFIX = "wro_";

export async function authenticate(req: Request): Promise<Principal> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : req.headers.get("x-api-key")?.trim();
  if (!token) throw new HttpError(401, "Missing API key. Send it as `Authorization: Bearer <key>`.");
  if (token.startsWith(OAUTH_TOKEN_PREFIX)) return authenticateOAuth(req, token);
  const [key] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, sha256(token))).limit(1);
  if (!key || key.revokedAt) throw new HttpError(401, "Invalid or revoked API key");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, key.orgId)).limit(1);
  if (!org) throw new HttpError(401, "Organization not found");
  if (key.teamId && org.settings.teamApiKeys === false) throw new HttpError(403, "Team API keys are disabled for this organization");
  const { assertIpAllowed, ipFromHeaders } = await import("../ip");
  await assertIpAllowed(org, ipFromHeaders(req.headers));
  const [user] = key.createdById ? await db.select().from(schema.users).where(eq(schema.users.id, key.createdById)).limit(1) : [];
  if (!user) throw new HttpError(401, "The user who created this key no longer exists");
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    await db.update(schema.apiKeys).set({ lastUsedAt: new Date() }).where(eq(schema.apiKeys.id, key.id));
  }
  return { via: "key", id: key.id, teamId: key.teamId, scopes: key.scopes, org, user };
}

async function authenticateOAuth(req: Request, token: string): Promise<Principal> {
  const [grant] = await db.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.accessTokenHash, sha256(token))).limit(1);
  if (!grant || grant.revokedAt || grant.accessExpiresAt < new Date()) throw new HttpError(401, "Invalid or expired access token");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, grant.orgId)).limit(1);
  if (!org || org.settings.connectedApps === false) throw new HttpError(403, "Connected apps are turned off for this organization");
  const { assertIpAllowed, ipFromHeaders } = await import("../ip");
  await assertIpAllowed(org, ipFromHeaders(req.headers));
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, grant.userId)).limit(1);
  const [ou] = user ? await db.select().from(schema.orgUsers).where(and(eq(schema.orgUsers.orgId, org.id), eq(schema.orgUsers.userId, user.id))).limit(1) : [];
  if (!user || !ou?.active) throw new HttpError(401, "This account no longer has access");
  if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > 60_000) {
    await db.update(schema.oauthGrants).set({ lastUsedAt: new Date() }).where(eq(schema.oauthGrants.id, grant.id));
  }
  return { via: "oauth", id: grant.id, teamId: null, scopes: grant.scope.split(/\s+/), org, user };
}

export function requireScope(p: Principal, scope: "read" | "write" | "scim") {
  if (!p.scopes.includes(scope)) throw new HttpError(403, `This ${p.via === "key" ? "API key" : "connection"} doesn't have the "${scope}" scope`);
}

/** Teams an OAuth principal (a person) can see: their own, or all when they're an org admin or transparency is on. */
async function personTeamIds(p: Principal) {
  const { getOrgUser, isOrgAdmin } = await import("../access");
  const ou = await getOrgUser(p.org.id, p.user.id);
  if (isOrgAdmin(ou) || p.org.settings.teamTransparency) return null;
  const rows = await db.select({ teamId: schema.members.teamId }).from(schema.members).where(eq(schema.members.userId, p.user.id));
  return rows.map((r) => r.teamId);
}

async function allowedTeams(p: Principal) {
  const ids = p.via === "oauth" ? await personTeamIds(p) : null;
  if (ids && !ids.length) return [];
  return db
    .select()
    .from(schema.teams)
    .where(and(eq(schema.teams.orgId, p.org.id), isNull(schema.teams.deletedAt), p.teamId ? eq(schema.teams.id, p.teamId) : undefined, ids ? inArray(schema.teams.id, ids) : undefined))
    .orderBy(asc(schema.teams.name));
}

async function team(p: Principal, teamId: string, write = false) {
  if (p.teamId && p.teamId !== teamId) throw new HttpError(404, "Team not found");
  const [t] = await db.select().from(schema.teams).where(and(eq(schema.teams.id, teamId), eq(schema.teams.orgId, p.org.id), isNull(schema.teams.deletedAt))).limit(1);
  if (!t) throw new HttpError(404, "Team not found");
  if (p.via === "oauth") {
    const { getTeamAccess } = await import("../access");
    const access = await getTeamAccess(p.user, teamId);
    if (!access) throw new HttpError(404, "Team not found");
    if (write && access.isViewer) throw new HttpError(403, "You can only view this team");
  }
  return t;
}

const teamDTO = (t: typeof schema.teams.$inferSelect) => ({
  id: t.id,
  name: t.name,
  description: t.description,
  color: t.color,
  tags: t.tags,
  isProgram: t.isProgram,
  archived: !!t.archivedAt,
  createdAt: t.createdAt.toISOString(),
});

export async function listTeams(p: Principal) {
  requireScope(p, "read");
  return (await allowedTeams(p)).map(teamDTO);
}

export async function getTeam(p: Principal, teamId: string) {
  requireScope(p, "read");
  return teamDTO(await team(p, teamId));
}

export async function listMembers(p: Principal, teamId: string) {
  requireScope(p, "read");
  await team(p, teamId);
  const rows = await db
    .select({ m: schema.members, u: schema.users })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.teamId, teamId))
    .orderBy(asc(schema.users.name));
  return rows.map(({ m, u }) => ({ id: u.id, name: u.name, email: u.email, roles: m.roles, tags: m.tags, joined: !!m.joinedAt }));
}

const KINDS = ["action", "agreement", "parked"] as const;
type Kind = (typeof KINDS)[number];

async function actionDTOs(rows: (typeof schema.actionItems.$inferSelect)[]) {
  const ids = [...new Set(rows.flatMap((r) => r.assigneeIds))];
  const users = ids.length ? await db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email }).from(schema.users).where(inArray(schema.users.id, ids)) : [];
  return rows.map((r) => ({
    id: r.id,
    teamId: r.teamId,
    meetingId: r.meetingId,
    kind: r.kind,
    title: r.title,
    description: r.description,
    status: r.status,
    priority: r.priority,
    dueDate: r.dueDate,
    assignees: r.assigneeIds.map((id) => users.find((u) => u.id === id)).filter(Boolean),
    source: r.sourceText ? { text: r.sourceText, meeting: r.sourceMeetingTitle } : null,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));
}

export async function listActions(p: Principal, teamId: string, opts: { kind?: string | null; status?: string | null } = {}) {
  requireScope(p, "read");
  await team(p, teamId);
  const kind = (KINDS as readonly string[]).includes(opts.kind ?? "") ? (opts.kind as Kind) : "action";
  const statuses = opts.status ? opts.status.split(",") : ["accepted", "completed"];
  const rows = await db
    .select()
    .from(schema.actionItems)
    .where(and(eq(schema.actionItems.teamId, teamId), eq(schema.actionItems.kind, kind), isNull(schema.actionItems.deletedAt), inArray(schema.actionItems.status, statuses)))
    .orderBy(asc(schema.actionItems.position));
  return actionDTOs(rows);
}

async function resolveAssignees(teamId: string, input: unknown) {
  if (!Array.isArray(input)) return [];
  const wanted = input.map(String).map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return [];
  const rows = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.members)
    .innerJoin(schema.users, eq(schema.users.id, schema.members.userId))
    .where(eq(schema.members.teamId, teamId));
  const ids = wanted.map((w) => rows.find((r) => r.id === w || r.email?.toLowerCase() === w)?.id);
  const missing = wanted.filter((_, i) => !ids[i]);
  if (missing.length) throw new HttpError(400, `Not a member of this team: ${missing.join(", ")}`);
  return ids as string[];
}

export async function createAction(p: Principal, teamId: string, input: { title?: unknown; kind?: unknown; description?: unknown; assignees?: unknown; dueDate?: unknown; priority?: unknown }) {
  requireScope(p, "write");
  await team(p, teamId, true);
  const title = String(input.title ?? "").trim().slice(0, 1000);
  if (!title) throw new HttpError(400, "title is required");
  const kind = (KINDS as readonly string[]).includes(String(input.kind ?? "action")) ? (String(input.kind ?? "action") as Kind) : "action";
  const assigneeIds = await resolveAssignees(teamId, input.assignees);
  const dueDate = typeof input.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
  const priority = ["low", "medium", "high"].includes(String(input.priority)) ? String(input.priority) : null;
  const [pos] = await db.select({ m: max(schema.actionItems.position) }).from(schema.actionItems).where(and(eq(schema.actionItems.teamId, teamId), eq(schema.actionItems.kind, kind)));
  const [a] = await db
    .insert(schema.actionItems)
    .values({ teamId, kind, title, description: String(input.description ?? "").slice(0, 5000), assigneeIds, dueDate, priority, createdById: p.user.id, position: (pos?.m ?? 0) + 1 })
    .returning();
  void dispatchEvent(teamId, kind === "agreement" ? "agreement.created" : "action.created", { id: a.id, title });
  await bumpTeamMeetings(teamId);
  return (await actionDTOs([a]))[0];
}

export async function updateAction(p: Principal, actionId: string, input: Record<string, unknown>) {
  requireScope(p, "write");
  const [a] = await db.select().from(schema.actionItems).where(and(eq(schema.actionItems.id, actionId), isNull(schema.actionItems.deletedAt))).limit(1);
  if (!a) throw new HttpError(404, "Action not found");
  await team(p, a.teamId, true);
  const patch: Record<string, unknown> = {};
  for (const k of ["title", "description", "status", "dueDate", "priority", "kind"]) if (input[k] !== undefined) patch[k] = input[k];
  if (input.assignees !== undefined) patch.assigneeIds = await resolveAssignees(a.teamId, input.assignees);
  await updateActionItem(p.user.id, a, patch);
  await bumpTeamMeetings(a.teamId);
  const [fresh] = await db.select().from(schema.actionItems).where(eq(schema.actionItems.id, actionId)).limit(1);
  return (await actionDTOs([fresh]))[0];
}

export async function deleteAction(p: Principal, actionId: string) {
  requireScope(p, "write");
  const [a] = await db.select().from(schema.actionItems).where(and(eq(schema.actionItems.id, actionId), isNull(schema.actionItems.deletedAt))).limit(1);
  if (!a) throw new HttpError(404, "Action not found");
  await team(p, a.teamId, true);
  await db.update(schema.actionItems).set({ deletedAt: new Date() }).where(eq(schema.actionItems.id, actionId));
  await bumpTeamMeetings(a.teamId);
  return { deleted: true };
}

const MEETING_TYPES: MeetingType[] = ["retrospective", "standup", "healthCheck", "estimation"];

export async function listMeetings(p: Principal, teamId: string, opts: { type?: string | null; status?: string | null; limit?: number } = {}) {
  requireScope(p, "read");
  await team(p, teamId);
  const rows = await db
    .select()
    .from(schema.meetings)
    .where(
      and(
        eq(schema.meetings.teamId, teamId),
        isNull(schema.meetings.deletedAt),
        eq(schema.meetings.isDemo, false),
        opts.type && MEETING_TYPES.includes(opts.type as MeetingType) ? eq(schema.meetings.type, opts.type) : undefined,
        opts.status === "open" || opts.status === "closed" ? eq(schema.meetings.status, opts.status) : undefined,
      ),
    )
    .orderBy(desc(schema.meetings.date), desc(schema.meetings.createdAt))
    .limit(Math.min(Math.max(opts.limit ?? 50, 1), 200));
  return rows.map((m) => ({
    id: m.id,
    teamId: m.teamId,
    type: m.type,
    title: m.title,
    date: m.date,
    status: m.status,
    template: m.templateName,
    url: `${process.env.APP_URL ?? ""}/m/${m.id}`,
    createdAt: m.createdAt.toISOString(),
    closedAt: m.closedAt?.toISOString() ?? null,
  }));
}

export async function getMeeting(p: Principal, meetingId: string) {
  requireScope(p, "read");
  const [m] = await db.select().from(schema.meetings).where(and(eq(schema.meetings.id, meetingId), isNull(schema.meetings.deletedAt))).limit(1);
  if (!m) throw new HttpError(404, "Meeting not found");
  await team(p, m.teamId);
  const ctx = await loadMeetingContext(m.id, p.user);
  const s = await buildMeetingState(ctx, p.user);
  const { markdown } = stateToMarkdown(s);
  return {
    id: m.id,
    teamId: m.teamId,
    type: m.type,
    title: m.title,
    date: m.date,
    status: m.status,
    template: m.templateName,
    topics: m.topics.map((t) => ({ id: t.id, title: t.title })),
    participants: s.participants.filter((x) => !x.invited).map((x) => ({ name: x.name, role: x.role })),
    ideas: m.status === "closed" || s.ideas.every((i) => !i.hidden) ? s.ideas.map((i) => ({ id: i.id, topicId: i.topicId, groupId: i.groupId, text: i.text })) : [],
    groups: s.groups.map((g) => ({ id: g.id, topicId: g.topicId, title: g.title })),
    actions: await actionDTOs(await db.select().from(schema.actionItems).where(and(eq(schema.actionItems.meetingId, m.id), isNull(schema.actionItems.deletedAt)))),
    estimation: s.estimation.map((e) => ({ id: e.id, title: e.title, estimate: e.finalEstimate })),
    health: s.health ? s.health.dimensions.map((d) => ({ dimension: d.name, mean: d.results?.mean ?? null, responses: d.results?.count ?? 0 })) : null,
    summary: m.aiSummary,
    markdown,
  };
}

export async function createMeetingFor(p: Principal, teamId: string, input: { type?: unknown; title?: unknown; templateId?: unknown; healthModelId?: unknown; deckId?: unknown; date?: unknown }) {
  requireScope(p, "write");
  await team(p, teamId, true);
  const type = String(input.type ?? "retrospective") as MeetingType;
  if (!MEETING_TYPES.includes(type)) throw new HttpError(400, `type must be one of ${MEETING_TYPES.join(", ")}`);
  const m = await createMeeting(p.user, teamId, {
    type,
    title: typeof input.title === "string" ? input.title : undefined,
    templateId: typeof input.templateId === "string" ? input.templateId : null,
    healthModelId: typeof input.healthModelId === "string" ? input.healthModelId : type === "healthCheck" ? "builtin-team-radar" : null,
    deckId: typeof input.deckId === "string" ? input.deckId : null,
    date: typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : undefined,
  });
  return (await listMeetings(p, teamId, { limit: 200 })).find((x) => x.id === m.id);
}

export async function teamHealth(p: Principal, teamId: string, modelId?: string | null) {
  requireScope(p, "read");
  const t = await team(p, teamId);
  let id = modelId || t.defaultHealthModelId;
  if (!id) {
    const [last] = await db
      .select({ id: schema.meetings.healthModelId })
      .from(schema.meetings)
      .where(and(eq(schema.meetings.teamId, teamId), eq(schema.meetings.type, "healthCheck"), isNull(schema.meetings.deletedAt), eq(schema.meetings.isDemo, false)))
      .orderBy(desc(schema.meetings.date))
      .limit(1);
    id = last?.id ?? null;
  }
  if (!id) return { model: null, dimensions: [], points: [] };
  const [model] = await db.select({ id: schema.healthModels.id, name: schema.healthModels.name }).from(schema.healthModels).where(eq(schema.healthModels.id, id)).limit(1);
  const h = await healthHistory([teamId], id);
  return { model: model ?? null, ...h };
}
