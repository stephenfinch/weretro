import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { createSession, createUser, findUserByEmail } from "@/server/auth";
import { ensureOrgUser, markJoined } from "@/server/orgs";
import { identityFrom, samlFor, ssoOrg } from "@/server/sso";
import { HttpError } from "@/server/access";
import { logActivity } from "@/server/activity";

/** SAML assertion consumer service: the identity provider POSTs the signed response here. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/sso/[org]/acs">) {
  const fail = (msg: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url), 303);
  try {
    const org = await ssoOrg((await ctx.params).org);
    const form = await req.formData();
    const SAMLResponse = String(form.get("SAMLResponse") ?? "");
    const relay = String(form.get("RelayState") ?? "");
    if (!SAMLResponse) return fail("Missing SAML response");
    const { profile } = await samlFor(org).validatePostResponseAsync({ SAMLResponse, RelayState: relay });
    if (!profile) return fail("Your identity provider didn't sign you in");
    const { email, name } = identityFrom(org, profile);
    let user = await findUserByEmail(email);
    if (!user) user = await createUser({ email, name, verified: true });
    else if (!user.emailVerifiedAt) await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, user.id));
    const ou = await ensureOrgUser(org.id, user.id);
    if (!ou.active) return fail("Your account has been deactivated in this organization");
    await createSession(user.id, { ssoOrgId: org.id });
    await markJoined(user.id);
    await logActivity({ orgId: org.id, userId: user.id, action: "sso.login" });
    const next = relay.startsWith("/") && !relay.startsWith("//") ? relay : `/o/${org.slug}`;
    return NextResponse.redirect(new URL(next, req.url), 303);
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message);
    console.error("SAML sign-in failed", e);
    return fail(`Single sign-on failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}
