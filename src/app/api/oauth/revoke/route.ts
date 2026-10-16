import { NextResponse, type NextRequest } from "next/server";
import { revokeToken } from "@/server/oauth-server";

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const token = String(form?.get("token") ?? "");
  if (token) await revokeToken(token);
  return new NextResponse(null, { status: 200, headers: { "access-control-allow-origin": "*" } });
}
