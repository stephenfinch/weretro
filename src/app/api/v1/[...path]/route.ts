import { NextResponse, type NextRequest } from "next/server";
import { HttpError } from "@/server/access";
import * as api from "@/server/api/service";

export const dynamic = "force-dynamic";

type Handler = (p: api.Principal, params: string[], req: NextRequest, body: Record<string, unknown>) => Promise<unknown>;

// [method, path pattern, handler]; ":x" segments are captured in order.
const ROUTES: [string, string, Handler][] = [
  ["GET", "teams", (p) => api.listTeams(p)],
  ["GET", "teams/:id", (p, [id]) => api.getTeam(p, id)],
  ["GET", "teams/:id/members", (p, [id]) => api.listMembers(p, id)],
  ["GET", "teams/:id/actions", (p, [id], req) => api.listActions(p, id, { kind: "action", status: req.nextUrl.searchParams.get("status") })],
  ["POST", "teams/:id/actions", (p, [id], _r, b) => api.createAction(p, id, { ...b, kind: "action" })],
  ["GET", "teams/:id/agreements", (p, [id], req) => api.listActions(p, id, { kind: "agreement", status: req.nextUrl.searchParams.get("status") })],
  ["POST", "teams/:id/agreements", (p, [id], _r, b) => api.createAction(p, id, { ...b, kind: "agreement" })],
  ["GET", "teams/:id/parking-lot", (p, [id], req) => api.listActions(p, id, { kind: "parked", status: req.nextUrl.searchParams.get("status") })],
  ["POST", "teams/:id/parking-lot", (p, [id], _r, b) => api.createAction(p, id, { ...b, kind: "parked" })],
  ["GET", "teams/:id/meetings", (p, [id], req) => api.listMeetings(p, id, { type: req.nextUrl.searchParams.get("type"), status: req.nextUrl.searchParams.get("status"), limit: Number(req.nextUrl.searchParams.get("limit") ?? 50) })],
  ["POST", "teams/:id/meetings", (p, [id], _r, b) => api.createMeetingFor(p, id, b)],
  ["GET", "teams/:id/health", (p, [id], req) => api.teamHealth(p, id, req.nextUrl.searchParams.get("modelId"))],
  ["GET", "meetings/:id", (p, [id]) => api.getMeeting(p, id)],
  ["PATCH", "actions/:id", (p, [id], _r, b) => api.updateAction(p, id, b)],
  ["DELETE", "actions/:id", (p, [id]) => api.deleteAction(p, id)],
];

function match(method: string, path: string[]) {
  for (const [m, pattern, handler] of ROUTES) {
    if (m !== method) continue;
    const parts = pattern.split("/");
    if (parts.length !== path.length) continue;
    const params: string[] = [];
    if (parts.every((seg, i) => (seg.startsWith(":") ? (params.push(decodeURIComponent(path[i])), true) : seg === path[i]))) return { handler, params };
  }
  return null;
}

async function handle(req: NextRequest, ctx: RouteContext<"/api/v1/[...path]">) {
  try {
    const { path } = await ctx.params;
    const route = match(req.method, path);
    if (!route) throw new HttpError(404, `No route for ${req.method} /api/v1/${path.join("/")}`);
    const principal = await api.authenticate(req);
    let body: Record<string, unknown> = {};
    if (req.method === "POST" || req.method === "PATCH") {
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        throw new HttpError(400, "Body must be JSON");
      }
    }
    const data = await route.handler(principal, route.params, req, body);
    return NextResponse.json({ data }, { status: req.method === "POST" ? 201 : 200 });
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: { status: e.status, message: e.message } }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: { status: 500, message: "Something went wrong" } }, { status: 500 });
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
