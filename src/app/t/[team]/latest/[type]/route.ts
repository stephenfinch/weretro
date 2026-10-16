import { NextResponse } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

// Always redirects to the team's most recent meeting of a given type.
export async function GET(req: Request, ctx: RouteContext<"/t/[team]/latest/[type]">) {
  const { team, type } = await ctx.params;
  const [m] = await db
    .select({ id: schema.meetings.id })
    .from(schema.meetings)
    .where(and(eq(schema.meetings.teamId, team), eq(schema.meetings.type, type), isNull(schema.meetings.deletedAt)))
    .orderBy(desc(schema.meetings.date), desc(schema.meetings.createdAt))
    .limit(1);
  const url = new URL(m ? `/m/${m.id}` : `/t/${team}`, req.url);
  return NextResponse.redirect(url);
}
