import "server-only";
import { cache } from "react";
import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { DEFAULT_PERMISSIONS } from "@/lib/constants";
import type { TeamPermissionKey, TeamRole } from "@/lib/types";
import { getCurrentUser, type CurrentUser } from "./auth";

/** Organizations can restrict access to certain IP ranges. */
async function guardIp(org: Org) {
  if (!org.settings?.allowedIpRanges?.length) return;
  const { currentIp } = await import("./ip");
  const { ipAllowed } = await import("@/lib/ip");
  if (!ipAllowed(await currentIp(), org.settings.allowedIpRanges)) redirect(`/blocked?org=${encodeURIComponent(org.name)}`);
}

/** Organizations can require members (not owners) to sign in through their identity provider. */
async function guardSso(org: Org, orgUser: OrgUser) {
  const sso = org.settings?.sso;
  if (!sso?.required || !sso.enabled || !sso.entryPoint || !sso.idpCert) return;
  if (orgUser.roles.includes("owner")) return;
  const { currentSessionSsoOrg } = await import("./auth");
  if ((await currentSessionSsoOrg()) === org.id) return;
  redirect(`/sso/${org.slug}`);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type Org = typeof schema.organizations.$inferSelect;
export type Team = typeof schema.teams.$inferSelect;
export type Member = typeof schema.members.$inferSelect;
export type OrgUser = typeof schema.orgUsers.$inferSelect;

export const getOrgUser = cache(async (orgId: string, userId: string) => {
  const rows = await db
    .select()
    .from(schema.orgUsers)
    .where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
});

export function isOrgAdmin(orgUser: OrgUser | null) {
  return !!orgUser && orgUser.active && (orgUser.roles.includes("owner") || orgUser.roles.includes("admin"));
}

export function canViewInsights(orgUser: OrgUser | null) {
  return isOrgAdmin(orgUser) || !!orgUser?.roles.includes("insightsViewer");
}

export type OrgAccess = { org: Org; orgUser: OrgUser; isAdmin: boolean; isOwner: boolean; canInsights: boolean };

export const getOrgAccess = cache(async (user: CurrentUser, orgIdOrSlug: string): Promise<OrgAccess | null> => {
  const rows = await db
    .select()
    .from(schema.organizations)
    .where(orgIdOrSlug.includes("-") && orgIdOrSlug.length === 36 ? eq(schema.organizations.id, orgIdOrSlug) : eq(schema.organizations.slug, orgIdOrSlug))
    .limit(1);
  const org = rows[0];
  if (!org) return null;
  const orgUser = await getOrgUser(org.id, user.id);
  if (!orgUser || !orgUser.active) return null;
  await guardIp(org);
  await guardSso(org, orgUser);
  return {
    org,
    orgUser,
    isAdmin: isOrgAdmin(orgUser),
    isOwner: orgUser.roles.includes("owner"),
    canInsights: canViewInsights(orgUser),
  };
});

export type TeamAccess = {
  team: Team;
  org: Org;
  member: Member | null;
  orgUser: OrgUser | null;
  roles: TeamRole[];
  isAdmin: boolean; // team admin or org admin
  isMember: boolean;
  isViewer: boolean; // read-only via transparency
  can: (perm: TeamPermissionKey) => boolean;
};

export const getTeamAccess = cache(async (user: CurrentUser, teamId: string): Promise<TeamAccess | null> => {
  const teamRows = await db
    .select()
    .from(schema.teams)
    .where(and(eq(schema.teams.id, teamId), isNull(schema.teams.deletedAt)))
    .limit(1);
  const team = teamRows[0];
  if (!team) return null;
  const [org] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, team.orgId)).limit(1);
  const orgUser = await getOrgUser(team.orgId, user.id);
  if (org) await guardIp(org);
  if (org && orgUser) await guardSso(org, orgUser);
  const memberRows = await db
    .select()
    .from(schema.members)
    .where(and(eq(schema.members.teamId, teamId), eq(schema.members.userId, user.id)))
    .limit(1);
  const member = memberRows[0] ?? null;
  const orgAdmin = isOrgAdmin(orgUser);
  const transparency = !!org?.settings?.teamTransparency;
  if (!member && !orgAdmin && !(transparency && orgUser?.active)) return null;
  const roles = (member?.roles ?? []) as TeamRole[];
  const isAdmin = orgAdmin || roles.includes("admin");
  const isMember = !!member && (roles.includes("member") || roles.includes("admin"));
  const archived = !!team.archivedAt;
  const can = (perm: TeamPermissionKey) => {
    if (archived) return false;
    if (isAdmin) return true;
    const allowed = team.options?.permissions?.[perm] ?? DEFAULT_PERMISSIONS[perm];
    return roles.some((r) => allowed.includes(r));
  };
  return { team, org, member, orgUser, roles, isAdmin, isMember, isViewer: !member && !orgAdmin, can };
});

export async function requireTeamAccess(teamId: string, perm?: TeamPermissionKey) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/t/${teamId}`);
  const access = await getTeamAccess(user, teamId);
  if (!access) notFound();
  if (perm && !access.can(perm)) throw new HttpError(403, "You don't have permission to do that");
  return { user, ...access };
}

export async function assertTeamAccess(user: CurrentUser, teamId: string, perm?: TeamPermissionKey) {
  const access = await getTeamAccess(user, teamId);
  if (!access) throw new HttpError(404, "Team not found");
  if (perm && !access.can(perm)) throw new HttpError(403, "You don't have permission to do that");
  return access;
}

export async function listUserOrgs(userId: string) {
  return db
    .select({ org: schema.organizations, orgUser: schema.orgUsers })
    .from(schema.orgUsers)
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.orgUsers.orgId))
    .where(and(eq(schema.orgUsers.userId, userId), eq(schema.orgUsers.active, true)));
}
