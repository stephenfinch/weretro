"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl, createEmailToken, findOrCreateInvitedUser, hashPassword, requireUser, verifyPassword } from "@/server/auth";
import { getOrgAccess, HttpError } from "@/server/access";
import { addTeamMember, ensureOrgUser } from "@/server/orgs";
import { escapeHtml, layout, sendMail } from "@/server/email";
import { logActivity } from "@/server/activity";
import type { NotificationPreferences, OrgSettings, TeamRole } from "@/lib/types";
import { ipAllowed, isValidRange } from "@/lib/ip";
import { currentIp } from "@/server/ip";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

async function wrap<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, error: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, error: "Something went wrong" };
  }
}

async function adminAccess(orgId: string) {
  const user = await requireUser();
  const access = await getOrgAccess(user, orgId);
  if (!access?.isAdmin) throw new HttpError(403, "Only organization admins can do that");
  return { user, access };
}

const ORG_ROLES = ["owner", "admin", "insightsViewer", "user"] as const;

export async function updateOrgAction(orgId: string, patch: { name?: string; color?: string; logoMediaId?: string | null; coverMediaId?: string | null; settings?: Partial<OrgSettings> }) {
  return wrap(async () => {
    const { user, access } = await adminAccess(orgId);
    const set: Partial<typeof schema.organizations.$inferInsert> = {};
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new HttpError(400, "Name is required");
      set.name = patch.name.trim().slice(0, 80);
    }
    if (patch.color) set.color = patch.color;
    if (patch.logoMediaId !== undefined) set.logoMediaId = patch.logoMediaId;
    if (patch.coverMediaId !== undefined) set.coverMediaId = patch.coverMediaId;
    if (patch.settings) {
      const s = { ...access.org.settings, ...patch.settings };
      if (s.allowedDomains) s.allowedDomains = [...new Set(s.allowedDomains.map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
      if (patch.settings.allowedIpRanges) {
        const ranges = [...new Set(patch.settings.allowedIpRanges.map((r) => r.trim()).filter(Boolean))];
        const bad = ranges.filter((r) => !isValidRange(r));
        if (bad.length) throw new HttpError(400, `Not a valid address or CIDR range: ${bad.join(", ")}`);
        const ip = await currentIp();
        if (ranges.length && ip && !ipAllowed(ip, ranges)) throw new HttpError(400, `Your current address (${ip}) isn't in these ranges, so saving would lock you out`);
        s.allowedIpRanges = ranges;
      }
      if (patch.settings.sso?.enabled) {
        const sso = patch.settings.sso;
        if (!sso.entryPoint?.startsWith("https://") && !sso.entryPoint?.startsWith("http://")) throw new HttpError(400, "Enter your identity provider's SSO URL");
        if (!sso.idpCert?.trim()) throw new HttpError(400, "Paste your identity provider's signing certificate");
      }
      set.settings = s;
    }
    await db.update(schema.organizations).set(set).where(eq(schema.organizations.id, orgId));
    await logActivity({ orgId, userId: user.id, action: "org.update", data: { fields: Object.keys(set) } });
    revalidatePath(`/o/${access.org.slug}`, "layout");
  });
}

export async function deleteOrgAction(orgId: string, confirmName: string) {
  const user = await requireUser();
  const access = await getOrgAccess(user, orgId);
  if (!access?.isOwner) return { ok: false as const, error: "Only the organization owner can delete it" };
  if (confirmName.trim() !== access.org.name) return { ok: false as const, error: "The name you typed doesn't match" };
  const teams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.orgId, orgId));
  const now = new Date();
  if (teams.length) {
    await db.update(schema.teams).set({ deletedAt: now }).where(inArray(schema.teams.id, teams.map((t) => t.id)));
    await db.update(schema.meetings).set({ deletedAt: now }).where(and(inArray(schema.meetings.teamId, teams.map((t) => t.id)), isNull(schema.meetings.deletedAt)));
    await db.delete(schema.members).where(inArray(schema.members.teamId, teams.map((t) => t.id)));
  }
  await db.delete(schema.orgUsers).where(eq(schema.orgUsers.orgId, orgId));
  await db.update(schema.apiKeys).set({ revokedAt: now }).where(eq(schema.apiKeys.orgId, orgId));
  await db.update(schema.organizations).set({ slug: `deleted-${orgId}` }).where(eq(schema.organizations.id, orgId));
  redirect("/home");
}

export async function inviteOrgUsers(orgId: string, input: { emails: string[]; roles?: string[]; teamIds?: string[]; teamRole?: TeamRole }) {
  return wrap(async () => {
    const { user, access } = await adminAccess(orgId);
    const allowed = access.org.settings.allowedDomains ?? [];
    const roles = (input.roles ?? ["user"]).filter((r) => (ORG_ROLES as readonly string[]).includes(r) && r !== "owner");
    const teams = input.teamIds?.length
      ? await db.select().from(schema.teams).where(and(eq(schema.teams.orgId, orgId), inArray(schema.teams.id, input.teamIds), isNull(schema.teams.deletedAt)))
      : [];
    const sent: string[] = [];
    for (const raw of input.emails) {
      const email = raw.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) continue;
      if (access.org.settings.enforceAllowedDomains && allowed.length && !allowed.some((d) => email.endsWith(`@${d}`))) throw new HttpError(400, `${email} is not in an allowed domain`);
      const invitee = await findOrCreateInvitedUser(email);
      const ou = await ensureOrgUser(orgId, invitee.id, user.id, !invitee.passwordHash && !invitee.emailVerifiedAt);
      const nextRoles = [...new Set([...(ou?.roles ?? ["user"]), ...roles])];
      await db.update(schema.orgUsers).set({ roles: nextRoles, active: true }).where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, invitee.id)));
      for (const t of teams) await addTeamMember(t.id, invitee.id, [input.teamRole ?? "member"], user.id, true);
      const { token } = await createEmailToken(email, "login", { userId: invitee.id, data: { next: `/o/${access.org.slug}` }, minutes: 60 * 24 * 14 });
      const link = appUrl(`/auth/magic?token=${token}`);
      await sendMail({
        to: email,
        subject: `${user.name} invited you to ${access.org.name} on WeRetro`,
        html: layout(
          `Join ${access.org.name}`,
          `<p>${escapeHtml(user.name)} has invited you to the <strong>${escapeHtml(access.org.name)}</strong> organization on WeRetro${teams.length ? ` and the team${teams.length > 1 ? "s" : ""} ${teams.map((t) => `<strong>${escapeHtml(t.name)}</strong>`).join(", ")}` : ""}.</p>`,
          { label: "Accept invitation", href: link },
        ),
        text: `${user.name} invited you to ${access.org.name}: ${link}`,
      });
      sent.push(email);
    }
    await logActivity({ orgId, userId: user.id, action: "org.invite", data: { emails: sent } });
    revalidatePath(`/o/${access.org.slug}/users`);
    return sent;
  });
}

export async function setOrgUserRoles(orgId: string, userId: string, roles: string[]) {
  return wrap(async () => {
    const { user, access } = await adminAccess(orgId);
    const clean = [...new Set(roles.filter((r) => (ORG_ROLES as readonly string[]).includes(r)))];
    if (!clean.length) clean.push("user");
    const [target] = await db.select().from(schema.orgUsers).where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, userId))).limit(1);
    if (!target) throw new HttpError(404, "User not found");
    const changingOwner = target.roles.includes("owner") !== clean.includes("owner");
    if (changingOwner && !access.isOwner) throw new HttpError(403, "Only an owner can change ownership");
    if (target.roles.includes("owner") && !clean.includes("owner")) {
      const owners = await db.select({ id: schema.orgUsers.id, roles: schema.orgUsers.roles }).from(schema.orgUsers).where(eq(schema.orgUsers.orgId, orgId));
      if (owners.filter((o) => o.roles.includes("owner")).length <= 1) throw new HttpError(400, "An organization needs at least one owner");
    }
    await db.update(schema.orgUsers).set({ roles: clean }).where(eq(schema.orgUsers.id, target.id));
    await logActivity({ orgId, userId: user.id, action: "org.roles", data: { userId, roles: clean } });
    revalidatePath(`/o/${access.org.slug}/users`);
  });
}

export async function setOrgUserActive(orgId: string, userId: string, active: boolean) {
  return wrap(async () => {
    const { user, access } = await adminAccess(orgId);
    if (userId === user.id) throw new HttpError(400, "You can't deactivate yourself");
    const [target] = await db.select().from(schema.orgUsers).where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, userId))).limit(1);
    if (!target) throw new HttpError(404, "User not found");
    if (target.roles.includes("owner") && !access.isOwner) throw new HttpError(403, "Only an owner can deactivate another owner");
    await db.update(schema.orgUsers).set({ active }).where(eq(schema.orgUsers.id, target.id));
    if (!active) {
      const teams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.orgId, orgId));
      if (teams.length) await db.delete(schema.members).where(and(eq(schema.members.userId, userId), inArray(schema.members.teamId, teams.map((t) => t.id))));
      await db.update(schema.apiKeys).set({ revokedAt: new Date() }).where(and(eq(schema.apiKeys.orgId, orgId), eq(schema.apiKeys.createdById, userId), isNull(schema.apiKeys.revokedAt)));
    }
    await logActivity({ orgId, userId: user.id, action: active ? "org.reactivate" : "org.deactivate", data: { userId } });
    revalidatePath(`/o/${access.org.slug}/users`);
  });
}

export async function removeOrgUser(orgId: string, userId: string) {
  return wrap(async () => {
    const { user, access } = await adminAccess(orgId);
    if (userId === user.id) throw new HttpError(400, "Use “Leave organization” to remove yourself");
    const [target] = await db.select().from(schema.orgUsers).where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, userId))).limit(1);
    if (!target) throw new HttpError(404, "User not found");
    if (target.roles.includes("owner")) throw new HttpError(400, "Remove the owner role first");
    const teams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.orgId, orgId));
    if (teams.length) await db.delete(schema.members).where(and(eq(schema.members.userId, userId), inArray(schema.members.teamId, teams.map((t) => t.id))));
    await db.delete(schema.orgUsers).where(eq(schema.orgUsers.id, target.id));
    await logActivity({ orgId, userId: user.id, action: "org.remove", data: { userId } });
    revalidatePath(`/o/${access.org.slug}/users`);
  });
}

export async function leaveOrgAction(orgId: string) {
  const user = await requireUser();
  const access = await getOrgAccess(user, orgId);
  if (!access) return { ok: false as const, error: "Not a member" };
  if (access.isOwner) {
    const owners = await db.select({ roles: schema.orgUsers.roles }).from(schema.orgUsers).where(eq(schema.orgUsers.orgId, orgId));
    if (owners.filter((o) => o.roles.includes("owner")).length <= 1) return { ok: false as const, error: "Make someone else an owner before leaving" };
  }
  const teams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.orgId, orgId));
  if (teams.length) await db.delete(schema.members).where(and(eq(schema.members.userId, user.id), inArray(schema.members.teamId, teams.map((t) => t.id))));
  await db.delete(schema.orgUsers).where(eq(schema.orgUsers.id, access.orgUser.id));
  redirect("/home");
}

// ── Profile ───────────────────────────────────────────────────────────────

export async function updateProfileAction(patch: { name?: string; color?: string; avatarMediaId?: string | null; timezone?: string; language?: string; colorScheme?: string }) {
  return wrap(async () => {
    const user = await requireUser();
    const set: Partial<typeof schema.users.$inferInsert> = {};
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new HttpError(400, "Name is required");
      set.name = patch.name.trim().slice(0, 80);
    }
    if (patch.color) set.color = patch.color;
    if (patch.avatarMediaId !== undefined) set.avatarMediaId = patch.avatarMediaId;
    if (patch.timezone) set.timezone = patch.timezone;
    if (patch.language) set.language = patch.language;
    if (patch.colorScheme) set.colorScheme = patch.colorScheme;
    await db.update(schema.users).set(set).where(eq(schema.users.id, user.id));
    revalidatePath("/", "layout");
  });
}

export async function changePasswordAction(current: string, next: string) {
  return wrap(async () => {
    const user = await requireUser();
    const [row] = await db.select({ hash: schema.users.passwordHash }).from(schema.users).where(eq(schema.users.id, user.id)).limit(1);
    if (row?.hash && !(await verifyPassword(current, row.hash))) throw new HttpError(400, "Your current password is incorrect");
    if (next.length < 8) throw new HttpError(400, "Use at least 8 characters");
    await db.update(schema.users).set({ passwordHash: await hashPassword(next) }).where(eq(schema.users.id, user.id));
  });
}

export async function saveNotificationPrefs(orgId: string | null, prefs: Record<string, boolean>) {
  return wrap(async () => {
    const user = await requireUser();
    const value: NotificationPreferences = { ...prefs };
    if (orgId) {
      await db.update(schema.orgUsers).set({ notificationPreferences: value }).where(and(eq(schema.orgUsers.orgId, orgId), eq(schema.orgUsers.userId, user.id)));
    } else {
      await db.update(schema.users).set({ notificationPreferences: value }).where(eq(schema.users.id, user.id));
    }
  });
}

export async function deleteAccountAction(confirmEmail: string) {
  const user = await requireUser();
  if (!user.email || confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) return { ok: false as const, error: "Type your email address to confirm" };
  const owned = await db.select({ orgId: schema.orgUsers.orgId, roles: schema.orgUsers.roles }).from(schema.orgUsers).where(eq(schema.orgUsers.userId, user.id));
  for (const o of owned.filter((x) => x.roles.includes("owner"))) {
    const owners = await db.select({ roles: schema.orgUsers.roles }).from(schema.orgUsers).where(eq(schema.orgUsers.orgId, o.orgId));
    const others = await db.select({ id: schema.orgUsers.id }).from(schema.orgUsers).where(eq(schema.orgUsers.orgId, o.orgId));
    if (owners.filter((x) => x.roles.includes("owner")).length <= 1 && others.length > 1) return { ok: false as const, error: "Transfer ownership of your organizations first" };
  }
  await db.delete(schema.members).where(eq(schema.members.userId, user.id));
  await db.delete(schema.orgUsers).where(eq(schema.orgUsers.userId, user.id));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
  await db.delete(schema.oauthAccounts).where(eq(schema.oauthAccounts.userId, user.id));
  await db.update(schema.users).set({ email: null, name: "Deleted user", passwordHash: null, avatarMediaId: null, options: { deletedAt: new Date().toISOString() } }).where(eq(schema.users.id, user.id));
  redirect("/login");
}

export async function revokeConnectedApp(orgId: string, grantId: string) {
  return wrap(async () => {
    const user = await requireUser();
    const access = await getOrgAccess(user, orgId);
    if (!access) throw new HttpError(403, "Not a member of this organization");
    const [g] = await db.select().from(schema.oauthGrants).where(and(eq(schema.oauthGrants.id, grantId), eq(schema.oauthGrants.orgId, orgId))).limit(1);
    if (!g) throw new HttpError(404, "Connection not found");
    if (g.userId !== user.id && !access.isAdmin) throw new HttpError(403, "Only admins can disconnect other people's apps");
    await db.update(schema.oauthGrants).set({ revokedAt: new Date() }).where(eq(schema.oauthGrants.id, grantId));
  });
}

export async function dismissTip(key: string) {
  const user = await requireUser();
  const options = (user.options ?? {}) as { dismissedTips?: string[] };
  const tips = [...new Set([...(options.dismissedTips ?? []), key.slice(0, 120)])].slice(-200);
  await db.update(schema.users).set({ options: { ...options, dismissedTips: tips } }).where(eq(schema.users.id, user.id));
}
