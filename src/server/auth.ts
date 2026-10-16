import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { AVATAR_COLORS } from "@/lib/constants";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "wr_session";
const SESSION_DAYS = 30;

export type CurrentUser = typeof schema.users.$inferSelect;

export function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined) {
  if (!stored) return false;
  const [algo, saltB64, keyB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !keyB64) return false;
  const key = Buffer.from(keyB64, "base64");
  const derived = await scrypt(password, Buffer.from(saltB64, "base64"), key.length);
  return timingSafeEqual(key, derived);
}

export function pickColor(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const ua = (await headers()).get("user-agent") ?? null;
  await db.insert(schema.sessions).values({ id: sha256(token), userId, expiresAt, userAgent: ua });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(SESSION_COOKIE);
}

export async function userFromToken(token: string | undefined | null): Promise<CurrentUser | null> {
  if (!token) return null;
  const rows = await db
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

export async function findUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return rows[0] ?? null;
}

export async function createUser(input: { email?: string | null; name: string; password?: string; isGuest?: boolean; verified?: boolean }) {
  const name = input.name.trim() || (input.email ? input.email.split("@")[0] : "Guest");
  const [user] = await db
    .insert(schema.users)
    .values({
      email: input.email ? input.email.trim().toLowerCase() : null,
      name,
      initials: initialsOf(name),
      color: pickColor(input.email ?? name + Math.random()),
      passwordHash: input.password ? await hashPassword(input.password) : null,
      isGuest: input.isGuest ?? false,
      emailVerifiedAt: input.verified ? new Date() : null,
    })
    .returning();
  return user;
}

/** Find a user by email or create a placeholder (invited) user. */
export async function findOrCreateInvitedUser(email: string, name?: string) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  return createUser({ email, name: name ?? email.split("@")[0] });
}

export async function createEmailToken(email: string, purpose: string, opts: { userId?: string; data?: Record<string, unknown>; minutes?: number } = {}) {
  const token = randomToken(24);
  const code = String(Math.floor(100000 + Math.random() * 900000));
  await db.insert(schema.emailTokens).values({
    email: email.toLowerCase(),
    userId: opts.userId,
    purpose,
    tokenHash: sha256(token),
    code,
    data: opts.data ?? {},
    expiresAt: new Date(Date.now() + (opts.minutes ?? 60 * 24) * 60_000),
  });
  return { token, code };
}

export async function consumeEmailToken(token: string, purpose?: string) {
  const rows = await db
    .select()
    .from(schema.emailTokens)
    .where(
      and(
        eq(schema.emailTokens.tokenHash, sha256(token)),
        isNull(schema.emailTokens.usedAt),
        gt(schema.emailTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row || (purpose && row.purpose !== purpose)) return null;
  await db.update(schema.emailTokens).set({ usedAt: new Date() }).where(eq(schema.emailTokens.id, row.id));
  return row;
}

export function appUrl(path = "") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
