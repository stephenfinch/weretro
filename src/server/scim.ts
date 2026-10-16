import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { randomCode } from "./orgs";
import type { TeamRole } from "@/lib/types";

type Org = typeof schema.organizations.$inferSelect;

function patternRegex(pattern: string | undefined) {
  if (!pattern?.includes("{team}")) return null;
  const [before, after] = pattern.split("{team}");
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${esc(before)}(.+)${esc(after)}$`, "i");
}

/**
 * Re-derive every SCIM-granted role from the organization's SCIM groups.
 * Roles granted by hand are never touched: we only add or remove what SCIM granted before.
 */
export async function syncScim(org: Org, createdById: string | null) {
  const cfg = org.settings.scim ?? {};
  const groups = await db.select().from(schema.scimGroups).where(eq(schema.scimGroups.orgId, org.id));
  const inGroup = (name: string | undefined) => new Set(name ? groups.filter((g) => g.displayName.toLowerCase() === name.toLowerCase()).flatMap((g) => g.memberIds) : []);

  // ── Organization roles ──
  const owners = inGroup(cfg.ownersGroup);
  const admins = inGroup(cfg.adminsGroup);
  const orgUsers = await db.select().from(schema.orgUsers).where(eq(schema.orgUsers.orgId, org.id));
  const everyGroupMember = new Set(groups.flatMap((g) => g.memberIds));
  for (const ou of orgUsers) {
    const want = [...(owners.has(ou.userId) ? ["owner", "admin"] : []), ...(admins.has(ou.userId) ? ["admin"] : [])];
    const manual = ou.roles.filter((r) => !ou.scimRoles.includes(r));
    const roles = [...new Set([...manual, ...want])];
    if (!roles.length) roles.push("user");
    const patch: Partial<typeof schema.orgUsers.$inferInsert> = {};
    if (roles.sort().join() !== [...ou.roles].sort().join()) patch.roles = roles;
    if (want.sort().join() !== [...ou.scimRoles].sort().join()) patch.scimRoles = [...new Set(want)];
    if (cfg.allowDeactivation && ou.provisionedBy === "scim") {
      const active = everyGroupMember.has(ou.userId);
      if (active !== ou.active) patch.active = active;
    }
    if (Object.keys(patch).length) await db.update(schema.orgUsers).set(patch).where(eq(schema.orgUsers.id, ou.id));
  }

  // ── Teams from group name patterns ──
  const adminRe = patternRegex(cfg.teamAdminsPattern);
  const memberRe = patternRegex(cfg.teamMembersPattern);
  if (!adminRe && !memberRe) return;
  const wanted = new Map<string, Map<string, Set<TeamRole>>>(); // team name → user → roles
  const teamNames = new Map<string, string>(); // lower-case key → name as written in the group
  for (const g of groups) {
    for (const [re, role] of [[adminRe, "admin"], [memberRe, "member"]] as const) {
      const m = re?.exec(g.displayName);
      if (!m) continue;
      const teamName = m[1].trim();
      const users = wanted.get(teamName.toLowerCase()) ?? new Map<string, Set<TeamRole>>();
      for (const uid of g.memberIds) users.set(uid, new Set([...(users.get(uid) ?? []), role, "member"] as TeamRole[]));
      wanted.set(teamName.toLowerCase(), users);
      if (!teamNames.has(teamName.toLowerCase())) teamNames.set(teamName.toLowerCase(), teamName);
    }
  }
  const teams = await db.select().from(schema.teams).where(and(eq(schema.teams.orgId, org.id), isNull(schema.teams.deletedAt)));
  const activeUsers = new Set(orgUsers.filter((o) => o.active).map((o) => o.userId));
  for (const [key, users] of wanted) {
    let team = teams.find((t) => t.name.toLowerCase() === key);
    if (!team) {
      [team] = await db.insert(schema.teams).values({ orgId: org.id, name: teamNames.get(key)!, code: randomCode(), lastActivityAt: new Date() }).returning();
      teams.push(team);
    }
    const existing = await db.select().from(schema.members).where(eq(schema.members.teamId, team.id));
    for (const [uid, roleSet] of users) {
      if (!activeUsers.has(uid)) continue;
      const want = [...roleSet];
      const m = existing.find((x) => x.userId === uid);
      if (!m) {
        await db.insert(schema.members).values({ teamId: team.id, userId: uid, roles: want, scimRoles: want, addedById: createdById, joinedAt: new Date() });
        continue;
      }
      const manual = m.roles.filter((r) => !m.scimRoles.includes(r));
      const roles = [...new Set([...manual, ...want])];
      await db.update(schema.members).set({ roles, scimRoles: want }).where(eq(schema.members.id, m.id));
    }
    // People who left the group lose what SCIM gave them; drop the membership if nothing manual remains.
    for (const m of existing) {
      if (users.has(m.userId) || !m.scimRoles.length) continue;
      const manual = m.roles.filter((r) => !m.scimRoles.includes(r));
      if (manual.length) await db.update(schema.members).set({ roles: manual, scimRoles: [] }).where(eq(schema.members.id, m.id));
      else await db.delete(schema.members).where(eq(schema.members.id, m.id));
    }
  }
  // Teams whose groups disappeared entirely: remove SCIM-only memberships there too.
  const scimTeams = teams.filter((t) => !wanted.has(t.name.toLowerCase()));
  if (scimTeams.length) {
    const stale = await db.select().from(schema.members).where(inArray(schema.members.teamId, scimTeams.map((t) => t.id)));
    for (const m of stale.filter((x) => x.scimRoles.length)) {
      const manual = m.roles.filter((r) => !m.scimRoles.includes(r));
      if (manual.length) await db.update(schema.members).set({ roles: manual, scimRoles: [] }).where(eq(schema.members.id, m.id));
      else await db.delete(schema.members).where(eq(schema.members.id, m.id));
    }
  }
}

