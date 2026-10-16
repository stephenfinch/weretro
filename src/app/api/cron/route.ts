import { NextResponse, type NextRequest } from "next/server";
import { runScheduler } from "@/server/meetings/series";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Call every few minutes (Vercel Cron, GitHub Actions, or any scheduler). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}` && req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const log = await runScheduler();
  return NextResponse.json({ ok: true, log });
}
