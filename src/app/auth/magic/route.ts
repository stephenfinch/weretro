import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { consumeEmailToken, createSession } from "@/server/auth";
import { captureByDomain, markJoined } from "@/server/orgs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const row = await consumeEmailToken(token, "login");
  if (!row?.userId) return NextResponse.redirect(new URL("/login?error=That+link+is+invalid+or+has+expired", req.url));
  await db.update(schema.users).set({ emailVerifiedAt: new Date() }).where(eq(schema.users.id, row.userId));
  await createSession(row.userId);
  await markJoined(row.userId);
  await captureByDomain(row.userId, row.email);
  const next = typeof row.data?.next === "string" && row.data.next.startsWith("/") ? row.data.next : "/home";
  return NextResponse.redirect(new URL(next, req.url));
}
