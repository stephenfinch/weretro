import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getProvider, fetchProfile } from "@/server/oauth";
import { createSession, createUser, findUserByEmail, getCurrentUser } from "@/server/auth";
import { captureByDomain } from "@/server/orgs";
import { markJoined } from "@/server/orgs";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const p = getProvider(provider);
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
  if (!p) return fail("That sign-in method isn't configured");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("oauth_state")?.value) return fail("Sign-in failed, please try again");
  try {
    const verifier = req.cookies.get("oauth_verifier")?.value ?? "";
    const tokens = p.kind === "github" ? await p.client.validateAuthorizationCode(code) : await p.client.validateAuthorizationCode(code, verifier);
    const profile = await fetchProfile(p, tokens.accessToken(), p.kind === "github" ? undefined : tokens.idToken());
    const [link] = await db
      .select()
      .from(schema.oauthAccounts)
      .where(and(eq(schema.oauthAccounts.provider, provider), eq(schema.oauthAccounts.providerUserId, profile.id)))
      .limit(1);
    let userId = link?.userId;
    if (!userId) {
      let user = (await getCurrentUser()) ?? (profile.email ? await findUserByEmail(profile.email) : null);
      if (user?.isGuest) user = null;
      if (!user) user = await createUser({ email: profile.email, name: profile.name, verified: true });
      userId = user.id;
      await db.insert(schema.oauthAccounts).values({ provider, providerUserId: profile.id, userId }).onConflictDoNothing();
      await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, userId));
      await captureByDomain(userId, profile.email);
    }
    await createSession(userId);
    await markJoined(userId);
    const next = req.cookies.get("oauth_next")?.value ?? "/home";
    return NextResponse.redirect(new URL(next.startsWith("/") ? next : "/home", req.url));
  } catch (e) {
    console.error(e);
    return fail("Sign-in failed, please try again");
  }
}
