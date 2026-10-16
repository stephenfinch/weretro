import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { mediaUrl } from "@/server/meetings/state";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const accounts = await db.select({ provider: schema.oauthAccounts.provider }).from(schema.oauthAccounts).where(eq(schema.oauthAccounts.userId, user.id));
  const apps = await db
    .select({ id: schema.oauthGrants.id, orgId: schema.oauthGrants.orgId, clientName: schema.oauthClients.name, orgName: schema.organizations.name, createdAt: schema.oauthGrants.createdAt, lastUsedAt: schema.oauthGrants.lastUsedAt })
    .from(schema.oauthGrants)
    .innerJoin(schema.oauthClients, eq(schema.oauthClients.id, schema.oauthGrants.clientId))
    .innerJoin(schema.organizations, eq(schema.organizations.id, schema.oauthGrants.orgId))
    .where(and(eq(schema.oauthGrants.userId, user.id), isNull(schema.oauthGrants.revokedAt)))
    .orderBy(desc(schema.oauthGrants.createdAt));
  return (
    <ProfileForm
      user={{ name: user.name, email: user.email, color: user.color, avatarUrl: mediaUrl(user.avatarMediaId), timezone: user.timezone, language: user.language, hasPassword: !!user.passwordHash }}
      providers={accounts.map((a) => a.provider)}
      apps={apps}
      available={{ google: !!process.env.GOOGLE_CLIENT_ID, github: !!process.env.GITHUB_CLIENT_ID, microsoft: !!process.env.MICROSOFT_CLIENT_ID }}
    />
  );
}
