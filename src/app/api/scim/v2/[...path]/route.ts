import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { HttpError } from "@/server/access";
import { authenticate, requireScope, type Principal } from "@/server/api/service";
import { createUser, findUserByEmail } from "@/server/auth";
import { ensureOrgUser } from "@/server/orgs";

/** Minimal SCIM 2.0 Users endpoint for identity providers (Okta, Entra ID, OneLogin…). */
export const dynamic = "force-dynamic";

const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const scim = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "content-type": "application/scim+json" } });
const scimError = (status: number, detail: string) => scim({ schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], status: String(status), detail }, status);

type Row = { u: typeof schema.users.$inferSelect; ou: typeof schema.orgUsers.$inferSelect };

function toScim(req: NextRequest, { u, ou }: Row) {
  const [givenName, ...rest] = u.name.split(" ");
  return {
    schemas: [USER_SCHEMA],
    id: u.id,
    userName: u.email,
    name: { formatted: u.name, givenName, familyName: rest.join(" ") },
    displayName: u.name,
    emails: u.email ? [{ value: u.email, primary: true, type: "work" }] : [],
    active: ou.active,
    meta: { resourceType: "User", created: ou.createdAt.toISOString(), location: new URL(`/api/scim/v2/Users/${u.id}`, req.url).toString() },
  };
}

async function rows(p: Principal, userIds?: string[]) {
  return db
    .select({ u: schema.users, ou: schema.orgUsers })
    .from(schema.orgUsers)
    .innerJoin(schema.users, eq(schema.users.id, schema.orgUsers.userId))
    .where(and(eq(schema.orgUsers.orgId, p.org.id), userIds ? inArray(schema.users.id, userIds) : undefined));
}

async function one(p: Principal, id: string) {
  const [r] = await rows(p, [id]);
  if (!r) throw new HttpError(404, "User not found");
  return r;
}

async function setActive(p: Principal, userId: string, active: boolean) {
  await db.update(schema.orgUsers).set({ active }).where(and(eq(schema.orgUsers.orgId, p.org.id), eq(schema.orgUsers.userId, userId)));
  if (!active) {
    const teams = await db.select({ id: schema.teams.id }).from(schema.teams).where(eq(schema.teams.orgId, p.org.id));
    if (teams.length) await db.delete(schema.members).where(and(eq(schema.members.userId, userId), inArray(schema.members.teamId, teams.map((t) => t.id))));
  }
}

function nameOf(body: Record<string, unknown>) {
  const n = body.name as { formatted?: string; givenName?: string; familyName?: string } | undefined;
  return (body.displayName as string) || n?.formatted || [n?.givenName, n?.familyName].filter(Boolean).join(" ") || "";
}

function emailOf(body: Record<string, unknown>) {
  const emails = body.emails as { value: string; primary?: boolean }[] | undefined;
  return (emails?.find((e) => e.primary)?.value ?? emails?.[0]?.value ?? (body.userName as string) ?? "").toLowerCase().trim();
}

async function handle(req: NextRequest, ctx: RouteContext<"/api/scim/v2/[...path]">) {
  try {
    const p = await authenticate(req);
    requireScope(p, "scim");
    if (p.key.teamId) throw new HttpError(403, "SCIM requires an account API key");
    const { path } = await ctx.params;
    const [resource, id] = path;

    if (resource === "ServiceProviderConfig") {
      return scim({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
        patch: { supported: true },
        bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
        filter: { supported: true, maxResults: 200 },
        changePassword: { supported: false },
        sort: { supported: false },
        etag: { supported: false },
        authenticationSchemes: [{ type: "oauthbearertoken", name: "Bearer token", description: "WeRetro account API key with the scim scope" }],
      });
    }
    if (resource === "ResourceTypes") return scim({ schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: 1, Resources: [{ id: "User", name: "User", endpoint: "/Users", schema: USER_SCHEMA }] });
    if (resource !== "Users") throw new HttpError(404, "Unknown resource");

    if (req.method === "GET" && !id) {
      const sp = req.nextUrl.searchParams;
      let list = await rows(p);
      const filter = sp.get("filter");
      const m = filter?.match(/^\s*(userName|emails(?:\.value)?)\s+eq\s+"([^"]+)"\s*$/i);
      if (m) list = list.filter((r) => r.u.email?.toLowerCase() === m[2].toLowerCase());
      const start = Math.max(1, Number(sp.get("startIndex") ?? 1));
      const count = Math.min(200, Math.max(0, Number(sp.get("count") ?? 100)));
      return scim({ schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"], totalResults: list.length, startIndex: start, itemsPerPage: count, Resources: list.slice(start - 1, start - 1 + count).map((r) => toScim(req, r)) });
    }
    if (req.method === "GET") return scim(toScim(req, await one(p, id)));

    if (req.method === "POST" && !id) {
      const body = (await req.json()) as Record<string, unknown>;
      const email = emailOf(body);
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "A valid userName or email is required");
      const existing = await findUserByEmail(email);
      const already = existing ? (await rows(p, [existing.id]))[0] : null;
      if (already) return scimError(409, "User already exists in this organization");
      const user = existing ?? (await createUser({ email, name: nameOf(body) || email.split("@")[0], verified: true }));
      await ensureOrgUser(p.org.id, user.id, p.user.id, true);
      if (body.active === false) await setActive(p, user.id, false);
      return scim(toScim(req, await one(p, user.id)), 201);
    }

    if ((req.method === "PUT" || req.method === "PATCH") && id) {
      const r = await one(p, id);
      const body = (await req.json()) as Record<string, unknown>;
      let active: boolean | undefined;
      let name: string | undefined;
      if (req.method === "PUT") {
        active = body.active === undefined ? undefined : body.active !== false;
        name = nameOf(body) || undefined;
      } else {
        for (const op of (body.Operations as { op: string; path?: string; value?: unknown }[]) ?? []) {
          if (op.op.toLowerCase() !== "replace" && op.op.toLowerCase() !== "add") continue;
          const value = op.value as Record<string, unknown> | boolean | string | undefined;
          if (op.path === "active") active = value === true || value === "True" || value === "true";
          else if (op.path === "displayName" || op.path === "name.formatted") name = String(value);
          else if (!op.path && value && typeof value === "object") {
            if ("active" in value) active = value.active === true || value.active === "True" || value.active === "true";
            if (nameOf(value)) name = nameOf(value);
          }
        }
      }
      if (name) await db.update(schema.users).set({ name: name.slice(0, 80) }).where(eq(schema.users.id, r.u.id));
      if (active !== undefined && active !== r.ou.active) await setActive(p, r.u.id, active);
      return scim(toScim(req, await one(p, id)));
    }

    if (req.method === "DELETE" && id) {
      await one(p, id);
      await setActive(p, id, false);
      return new NextResponse(null, { status: 204 });
    }
    throw new HttpError(405, "Method not allowed");
  } catch (e) {
    if (e instanceof HttpError) return scimError(e.status, e.message);
    console.error(e);
    return scimError(500, "Something went wrong");
  }
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
