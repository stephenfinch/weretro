import { NextResponse } from "next/server";
import { spMetadata, ssoOrg } from "@/server/sso";
import { jsonError } from "@/server/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/sso/[org]/metadata">) {
  try {
    const org = await ssoOrg((await ctx.params).org);
    return new NextResponse(spMetadata(org), { headers: { "content-type": "application/samlmetadata+xml; charset=utf-8" } });
  } catch (e) {
    return jsonError(e);
  }
}
