import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl, randomToken, sha256 } from "./auth";
import { HttpError } from "./access";
import { OAUTH_TOKEN_PREFIX } from "./api/service";

export const ACCESS_TTL_S = 3600;
const REFRESH_TTL_DAYS = 60;
export const SCOPES = ["read", "write"];

export function authServerMetadata() {
  return {
    issuer: appUrl(""),
    authorization_endpoint: appUrl("/oauth/authorize"),
    token_endpoint: appUrl("/api/oauth/token"),
    registration_endpoint: appUrl("/api/oauth/register"),
    revocation_endpoint: appUrl("/api/oauth/revoke"),
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: SCOPES,
  };
}

export function resourceMetadata() {
  return {
    resource: appUrl("/api/mcp"),
    authorization_servers: [appUrl("")],
    bearer_methods_supported: ["header"],
    scopes_supported: SCOPES,
    resource_name: "WeRetro",
  };
}

/** Redirect URIs must be https, or http on a loopback address (native/CLI clients). */
export function validRedirectUri(uri: string) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)) return true;
    // custom schemes used by desktop apps, eg. cursor://, vscode://
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !["http:", "javascript:", "data:", "file:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export async function getClient(clientId: string) {
  const [c] = await db.select().from(schema.oauthClients).where(eq(schema.oauthClients.id, clientId)).limit(1);
  return c ?? null;
}

export async function issueCode(input: { clientId: string; userId: string; orgId: string; redirectUri: string; codeChallenge: string; scope: string }) {
  const code = randomToken(32);
  await db.insert(schema.oauthCodes).values({ codeHash: sha256(code), ...input, expiresAt: new Date(Date.now() + 5 * 60_000) });
  return code;
}

function s256(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function newTokens(grant: { clientId: string; userId: string; orgId: string; scope: string }, existingId?: string) {
  const access = `${OAUTH_TOKEN_PREFIX}${randomToken(32)}`;
  const refresh = `wrr_${randomToken(32)}`;
  const values = { accessTokenHash: sha256(access), refreshTokenHash: sha256(refresh), accessExpiresAt: new Date(Date.now() + ACCESS_TTL_S * 1000) };
  if (existingId) await db.update(schema.oauthGrants).set(values).where(eq(schema.oauthGrants.id, existingId));
  else await db.insert(schema.oauthGrants).values({ ...grant, ...values });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: grant.scope };
}

export async function exchangeCode(input: { code: string; clientId: string; redirectUri: string; verifier: string }) {
  const [row] = await db
    .select()
    .from(schema.oauthCodes)
    .where(and(eq(schema.oauthCodes.codeHash, sha256(input.code)), isNull(schema.oauthCodes.usedAt), gt(schema.oauthCodes.expiresAt, new Date())))
    .limit(1);
  if (!row) throw new HttpError(400, "invalid_grant");
  await db.update(schema.oauthCodes).set({ usedAt: new Date() }).where(eq(schema.oauthCodes.codeHash, row.codeHash));
  if (row.clientId !== input.clientId || row.redirectUri !== input.redirectUri) throw new HttpError(400, "invalid_grant");
  if (!input.verifier || s256(input.verifier) !== row.codeChallenge) throw new HttpError(400, "invalid_grant");
  return newTokens({ clientId: row.clientId, userId: row.userId, orgId: row.orgId, scope: row.scope });
}

export async function refresh(input: { refreshToken: string; clientId: string }) {
  const [g] = await db.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.refreshTokenHash, sha256(input.refreshToken))).limit(1);
  if (!g || g.revokedAt || g.clientId !== input.clientId) throw new HttpError(400, "invalid_grant");
  if (Date.now() - g.createdAt.getTime() > REFRESH_TTL_DAYS * 86400_000 && (!g.lastUsedAt || Date.now() - g.lastUsedAt.getTime() > REFRESH_TTL_DAYS * 86400_000)) {
    throw new HttpError(400, "invalid_grant");
  }
  return newTokens(g, g.id);
}

export async function revokeToken(token: string) {
  const hash = sha256(token);
  await db.update(schema.oauthGrants).set({ revokedAt: new Date() }).where(eq(schema.oauthGrants.accessTokenHash, hash));
  await db.update(schema.oauthGrants).set({ revokedAt: new Date() }).where(eq(schema.oauthGrants.refreshTokenHash, hash));
}
