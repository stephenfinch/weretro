import { NextResponse, type NextRequest } from "next/server";
import { samlFor, ssoOrg } from "@/server/sso";
import { HttpError } from "@/server/access";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/sso/[org]/login">) {
  const next = req.nextUrl.searchParams.get("next");
  try {
    const org = await ssoOrg((await ctx.params).org);
    const url = await samlFor(org).getAuthorizeUrlAsync(next?.startsWith("/") ? next : `/o/${org.slug}`, undefined, {});
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof HttpError ? e.message : "Single sign-on failed";
    if (!(e instanceof HttpError)) console.error(e);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
  }
}
