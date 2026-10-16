import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { validRedirectUri } from "@/server/oauth-server";

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };

/** OAuth 2.0 Dynamic Client Registration (RFC 7591) for public clients such as MCP apps. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { client_name?: string; redirect_uris?: string[] };
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!uris.length || !uris.every(validRedirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri", error_description: "Redirect URIs must be https, loopback http, or an app scheme" }, { status: 400, headers: CORS });
  }
  const [client] = await db
    .insert(schema.oauthClients)
    .values({ name: (body.client_name || "MCP client").slice(0, 100), redirectUris: uris.slice(0, 10) })
    .returning();
  return NextResponse.json(
    {
      client_id: client.id,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    },
    { status: 201, headers: CORS },
  );
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
