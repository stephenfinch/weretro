import { NextResponse, type NextRequest } from "next/server";
import { generateCodeVerifier, generateState } from "arctic";
import { getProvider } from "@/server/oauth";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/[provider]/start">) {
  const { provider } = await ctx.params;
  const p = getProvider(provider);
  if (!p) return NextResponse.redirect(new URL("/login?error=That+sign-in+method+isn%27t+configured", req.url));
  const state = generateState();
  const verifier = generateCodeVerifier();
  const url =
    p.kind === "github"
      ? p.client.createAuthorizationURL(state, ["read:user", "user:email"])
      : p.client.createAuthorizationURL(state, verifier, ["openid", "profile", "email"]);
  const res = NextResponse.redirect(url);
  const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 };
  res.cookies.set("oauth_state", state, opts);
  res.cookies.set("oauth_verifier", verifier, opts);
  res.cookies.set("oauth_next", req.nextUrl.searchParams.get("next") ?? "/home", opts);
  return res;
}
