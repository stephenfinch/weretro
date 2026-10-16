import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { getTeamAccess } from "@/server/access";
import { allMeetingsWorkbook, csv, printableHtml, teamExport, xlsx } from "@/server/exports";
import { unauthorized } from "@/server/http";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/teams/[id]/export">) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  if (!(await getTeamAccess(user, id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const kind = req.nextUrl.searchParams.get("kind") ?? "actions";
  const format = req.nextUrl.searchParams.get("format") ?? "csv";
  if (kind === "all") {
    const buf = await allMeetingsWorkbook(id, user);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="team-all-meetings.xlsx"` } });
  }
  const data = await teamExport(id, kind, { mine: req.nextUrl.searchParams.get("mine") ? user.id : undefined });
  const name = data.title.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  if (format === "xlsx") {
    const buf = await xlsx([{ name: kind, rows: data.rows }]);
    return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"` } });
  }
  if (format === "md") return new NextResponse(data.markdown, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${name}.md"` } });
  if (format === "pdf") return new NextResponse(printableHtml(data.title, data.markdown), { headers: { "content-type": "text/html; charset=utf-8" } });
  return new NextResponse(csv(data.rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` } });
}
