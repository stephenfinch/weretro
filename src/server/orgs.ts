import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl, createEmailToken, findOrCreateInvitedUser, type CurrentUser } from "./auth";
import { layout, sendMail, escapeHtml } from "./email";
import { HttpError } from "./access";
import type { TeamRole } from "@/lib/types";
import { logActivity } from "./activity";

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "org"
  );
}

export function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 9; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${s.slice(0, 3)}-${s.slice(3, 6)}-${s.slice(6)}`;
}

export async function uniqueOrgSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const existing = await db.select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.slug, slug)).limit(1);
    if (!existing.length) return slug;
    slug = `${base}-${i}`;
  }
}

export async function createOrganization(user: CurrentUser, name: string) {
  const [org] = await db
    .insert(schema.organizations)
    .values({ name: name.trim(), slug: await uniqueOrgSlug(name), settings: { aiEnabled: true, allowGuests: true } })
    .returning();
  await db.insert(schema.orgUsers).values({
    orgId: org.id,
    userId: user.id,
    roles: ["owner", "admin", "insightsViewer", "user"],
    joinedAt: new Date(),
  });
  await logActivity({ orgId: org.id, userId: user.id, action: "org.create", entityType: "org", entityId: org.id });
  return org;
}

export async function createTeam(user: CurrentUser, orgId: string, input: { name: string; description?: string; color?: string; isProgram?: boolean; memberTeamIds?: string[] }) {
  const [team] = await db
    .insert(schema.teams)
    .values({
      orgId,
      name: input.name.trim(),
      description: input.description ?? "",
      color: input.color ?? "#6366F1",
      code: randomCode(),
      isProgram: input.isProgram ?? false,
      memberTeamIds: input.memberTeamIds ?? [],
      lastActivityAt: new Date(),
    })
    .returning();
  await db.insert(schema.members).values({ teamId: team.id, userId: user.id, roles: ["admin", "member"], joinedAt: new Date() });
  await logActivity({ orgId, teamId: team.id, userId: user.id, action: "team.create", entityType: "team", entityId: team.id });
  return team;
}

export async function ensureOrgUser(orgId: string, userId: string, addedById?: string, invited = false) {
  const existing = await db
    .select()
    .from(schema.orgUsers)
    .where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, userId)))
    .limit(1);
  if (existing[0]) {
    if (!existing[0].active) await db.update(schema.orgUsers).set({ active: true }).where(eq(schema.orgUsers.id, existing[0].id));
    return existing[0];
  }
  const [row] = await db
    .insert(schema.orgUsers)
    .values({ orgId, userId, roles: ["user"], addedById, invitedAt: invited ? new Date() : null, joinedAt: invited ? null : new Date() })
    .returning();
  return row;
}

export async function addTeamMember(teamId: string, userId: string, roles: TeamRole[], addedById?: string, invited = false) {
  const existing = await db
    .select()
    .from(schema.members)
    .where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, userId)))
    .limit(1);
  const fullRoles = roles.includes("admin") ? Array.from(new Set([...roles, "member"])) : roles;
  if (existing[0]) {
    await db.update(schema.members).set({ roles: fullRoles }).where(eq(schema.members.id, existing[0].id));
    return existing[0];
  }
  const [m] = await db
    .insert(schema.members)
    .values({ teamId, userId, roles: fullRoles, addedById, invitedAt: invited ? new Date() : null, joinedAt: invited ? null : new Date() })
    .returning();
  return m;
}

export async function inviteToTeam(inviter: CurrentUser, teamId: string, emails: string[], role: TeamRole = "member") {
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  if (!team) throw new HttpError(404, "Team not found");
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, team.orgId)).limit(1);
  const allowed = org.settings?.allowedDomains ?? [];
  const results: string[] = [];
  for (const raw of emails) {
    const email = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
    if (org.settings?.enforceAllowedDomains && allowed.length && !allowed.some((d) => email.endsWith(`@${d.toLowerCase()}`))) {
      throw new HttpError(400, `${email} is not in an allowed domain`);
    }
    const user = await findOrCreateInvitedUser(email);
    await ensureOrgUser(team.orgId, user.id, inviter.id, !user.passwordHash && !user.emailVerifiedAt);
    const already = await db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, user.id)))
      .limit(1);
    await addTeamMember(teamId, user.id, [role], inviter.id, !already.length);
    await sendTeamInvite(inviter, team.name, teamId, email, user.id);
    results.push(email);
  }
  await logActivity({ orgId: team.orgId, teamId, userId: inviter.id, action: "team.invite", data: { emails: results } });
  return results;
}

export async function sendTeamInvite(inviter: CurrentUser, teamName: string, teamId: string, email: string, userId: string) {
  const { token } = await createEmailToken(email, "login", { userId, data: { next: `/t/${teamId}` }, minutes: 60 * 24 * 14 });
  const link = appUrl(`/auth/magic?token=${token}`);
  await sendMail({
    to: email,
    subject: `${inviter.name} invited you to join ${teamName}`,
    html: layout(
      `Join ${teamName}`,
      `<p>${escapeHtml(inviter.name)} has invited you to the <strong>${escapeHtml(teamName)}</strong> team on WeRetro.</p>`,
      { label: "Accept invitation", href: link },
    ),
    text: `${inviter.name} invited you to ${teamName}: ${link}`,
  });
}

export async function joinTeamByCode(user: CurrentUser, code: string) {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const formatted = `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6, 9)}`;
  const [team] = await db
    .select()
    .from(schema.teams)
    .where(and(eq(schema.teams.code, formatted), isNull(schema.teams.deletedAt)))
    .limit(1);
  if (!team) return null;
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, team.orgId)).limit(1);
  const allowed = org.settings?.allowedDomains ?? [];
  if (org.settings?.enforceAllowedDomains && allowed.length && user.email && !allowed.some((d) => user.email!.endsWith(`@${d}`))) {
    throw new HttpError(403, "Your email domain isn't allowed in this organization");
  }
  await ensureOrgUser(team.orgId, user.id);
  await addTeamMember(team.id, user.id, ["member"]);
  return team;
}

export async function markJoined(userId: string) {
  await db.update(schema.members).set({ joinedAt: new Date() }).where(and(eq(schema.members.userId, userId), isNull(schema.members.joinedAt)));
  await db.update(schema.orgUsers).set({ joinedAt: new Date() }).where(and(eq(schema.orgUsers.userId, userId), isNull(schema.orgUsers.joinedAt)));
}

export async function listOrgTeams(orgId: string, includeArchived = false) {
  const rows = await db
    .select()
    .from(schema.teams)
    .where(and(eq(schema.teams.orgId, orgId), isNull(schema.teams.deletedAt), includeArchived ? undefined : isNull(schema.teams.archivedAt)))
    .orderBy(schema.teams.name);
  return rows;
}

export async function teamMemberCounts(teamIds: string[]) {
  if (!teamIds.length) return new Map<string, number>();
  const rows = await db
    .select({ teamId: schema.members.teamId, n: sql<number>`count(*)::int` })
    .from(schema.members)
    .where(inArray(schema.members.teamId, teamIds))
    .groupBy(schema.members.teamId);
  return new Map(rows.map((r) => [r.teamId, r.n]));
}

// Domain capture: verified users whose email domain an org has claimed join that org automatically.
export async function captureByDomain(userId: string, email: string | null | undefined) {
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain) return;
  const orgs = await db.select().from(schema.organizations).where(sql`${schema.organizations.settings}->>'domainCapture' = 'true'`);
  for (const org of orgs) {
    if ((org.settings.allowedDomains ?? []).includes(domain)) await ensureOrgUser(org.id, userId);
  }
}
