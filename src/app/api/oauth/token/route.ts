import { NextResponse, type NextRequest } from "next/server";
import { HttpError } from "@/server/access";
import { exchangeCode, refresh } from "@/server/oauth-server";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "POST, OPTIONS" };

async function params(req: NextRequest) {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) return new Map(Object.entries((await req.json()) as Record<string, string>));
  const form = await req.formData();
  return new Map([...form.entries()].map(([k, v]) => [k, String(v)]));
}

export async function POST(req: NextRequest) {
  try {
    const p = await params(req);
    const grant = p.get("grant_type");
    const clientId = p.get("client_id") ?? "";
    let tokens;
    if (grant === "authorization_code") tokens = await exchangeCode({ code: p.get("code") ?? "", clientId, redirectUri: p.get("redirect_uri") ?? "", verifier: p.get("code_verifier") ?? "" });
    else if (grant === "refresh_token") tokens = await refresh({ refreshToken: p.get("refresh_token") ?? "", clientId });
    else return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400, headers: CORS });
    return NextResponse.json(tokens, { headers: { ...CORS, "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: 400, headers: CORS });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: CORS });
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
