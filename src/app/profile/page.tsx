import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireUser } from "@/server/auth";
import { mediaUrl } from "@/server/meetings/state";
import { ProfileForm } from "@/components/profile/profile-form";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const accounts = await db.select({ provider: schema.oauthAccounts.provider }).from(schema.oauthAccounts).where(eq(schema.oauthAccounts.userId, user.id));
  return (
    <ProfileForm
      user={{ name: user.name, email: user.email, color: user.color, avatarUrl: mediaUrl(user.avatarMediaId), timezone: user.timezone, language: user.language, hasPassword: !!user.passwordHash }}
      providers={accounts.map((a) => a.provider)}
      available={{ google: !!process.env.GOOGLE_CLIENT_ID, github: !!process.env.GITHUB_CLIENT_ID, microsoft: !!process.env.MICROSOFT_CLIENT_ID }}
    />
  );
}
