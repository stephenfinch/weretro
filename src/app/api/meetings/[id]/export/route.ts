import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { csv, meetingExportRows, meetingState, printableHtml, stateToMarkdown, xlsx } from "@/server/exports";
import { jsonError, unauthorized } from "@/server/http";
import { healthHistoryRows } from "@/server/insights";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/meetings/[id]/export">) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const kind = req.nextUrl.searchParams.get("kind") ?? "summary";
    const format = req.nextUrl.searchParams.get("format") ?? "md";
    const s = await meetingState(id, user);
    const base = `${(s.meeting.title || s.meeting.date).replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}-${kind}`;
    if (kind === "summary" || kind === "summaryWithComment") {
      const { title, markdown } = stateToMarkdown(s, { withComments: kind === "summaryWithComment" });
      if (format === "pdf") return new NextResponse(printableHtml(title, markdown), { headers: { "content-type": "text/html; charset=utf-8" } });
      return new NextResponse(markdown, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${base}.md"` } });
    }
    const rows = kind === "healthHistory" ? await healthHistoryRows(s.team.id, s.meeting.healthModelId) : await meetingExportRows(s, kind);
    if (format === "xlsx") {
      const buf = await xlsx([{ name: kind, rows }]);
      return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${base}.xlsx"` } });
    }
    return new NextResponse(csv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${base}.csv"` } });
  } catch (e) {
    return jsonError(e);
  }
}
