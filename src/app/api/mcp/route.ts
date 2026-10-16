import { NextResponse, type NextRequest } from "next/server";
import { HttpError } from "@/server/access";
import * as api from "@/server/api/service";

/**
 * Model Context Protocol server (Streamable HTTP transport, stateless, JSON responses).
 * Point any MCP client at `<APP_URL>/api/mcp` with header `Authorization: Bearer <api key>`.
 */
export const dynamic = "force-dynamic";

const PROTOCOL = "2025-06-18";

type Tool = { name: string; description: string; inputSchema: Record<string, unknown>; run: (p: api.Principal, a: Record<string, unknown>) => Promise<unknown>; write?: boolean };

const s = (description: string) => ({ type: "string", description });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });
const str = (v: unknown) => (typeof v === "string" ? v : "");

const TOOLS: Tool[] = [
  { name: "list_teams", description: "List the teams this API key can access.", inputSchema: obj({}), run: (p) => api.listTeams(p) },
  { name: "list_team_members", description: "List the members of a team with their roles.", inputSchema: obj({ team_id: s("Team ID") }, ["team_id"]), run: (p, a) => api.listMembers(p, str(a.team_id)) },
  {
    name: "list_actions",
    description: "List a team's action items, agreements or parking lot items.",
    inputSchema: obj({ team_id: s("Team ID"), kind: { type: "string", enum: ["action", "agreement", "parked"], description: "Defaults to action" }, status: s("Comma-separated statuses, e.g. accepted,completed. Defaults to accepted,completed") }, ["team_id"]),
    run: (p, a) => api.listActions(p, str(a.team_id), { kind: str(a.kind) || "action", status: str(a.status) || null }),
  },
  {
    name: "create_action",
    description: "Create an action item, team agreement or parking lot item.",
    write: true,
    inputSchema: obj(
      {
        team_id: s("Team ID"),
        title: s("What needs to happen"),
        kind: { type: "string", enum: ["action", "agreement", "parked"] },
        assignees: { type: "array", items: { type: "string" }, description: "Member emails or user IDs" },
        due_date: s("YYYY-MM-DD"),
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      ["team_id", "title"],
    ),
    run: (p, a) => api.createAction(p, str(a.team_id), { title: a.title, kind: a.kind, assignees: a.assignees, dueDate: a.due_date, priority: a.priority }),
  },
  {
    name: "update_action",
    description: "Update an action item: rename it, reassign it, change its due date, or mark it completed.",
    write: true,
    inputSchema: obj(
      {
        action_id: s("Action ID"),
        title: s("New title"),
        status: { type: "string", enum: ["accepted", "completed", "canceled"] },
        assignees: { type: "array", items: { type: "string" } },
        due_date: { type: ["string", "null"], description: "YYYY-MM-DD or null" },
      },
      ["action_id"],
    ),
    run: (p, a) => api.updateAction(p, str(a.action_id), { title: a.title, status: a.status, assignees: a.assignees, dueDate: a.due_date }),
  },
  {
    name: "list_meetings",
    description: "List a team's meetings, newest first.",
    inputSchema: obj({ team_id: s("Team ID"), type: { type: "string", enum: ["retrospective", "standup", "healthCheck", "estimation"] }, status: { type: "string", enum: ["open", "closed"] }, limit: { type: "integer", minimum: 1, maximum: 200 } }, ["team_id"]),
    run: (p, a) => api.listMeetings(p, str(a.team_id), { type: str(a.type) || null, status: str(a.status) || null, limit: typeof a.limit === "number" ? a.limit : 20 }),
  },
  { name: "get_meeting", description: "Get a meeting's details and a Markdown summary: ideas, votes, actions, health results or estimates.", inputSchema: obj({ meeting_id: s("Meeting ID") }, ["meeting_id"]), run: (p, a) => api.getMeeting(p, str(a.meeting_id)) },
  {
    name: "create_meeting",
    description: "Start a new meeting for a team. Returns the meeting URL to share.",
    write: true,
    inputSchema: obj({ team_id: s("Team ID"), type: { type: "string", enum: ["retrospective", "standup", "healthCheck", "estimation"] }, title: s("Optional title"), template_id: s("Optional template ID, e.g. builtin:start-stop-continue") }, ["team_id", "type"]),
    run: (p, a) => api.createMeetingFor(p, str(a.team_id), { type: a.type, title: a.title, templateId: a.template_id }),
  },
  { name: "get_team_health", description: "Get a team's health check history for one health model (defaults to the team's default or latest).", inputSchema: obj({ team_id: s("Team ID"), model_id: s("Optional health model ID") }, ["team_id"]), run: (p, a) => api.teamHealth(p, str(a.team_id), str(a.model_id) || null) },
];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function dispatch(p: api.Principal, msg: RpcRequest) {
  switch (msg.method) {
    case "initialize":
      return { protocolVersion: PROTOCOL, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "weretro", version: "1.0.0" }, instructions: "Tools for reading and updating WeRetro teams, actions, meetings and health checks." };
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS.filter((t) => !t.write || p.key.scopes.includes("write")).map(({ name, description, inputSchema, write }) => ({ name, description, inputSchema, annotations: { readOnlyHint: !write } })) };
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) throw Object.assign(new Error(`Unknown tool: ${name}`), { code: -32602 });
      try {
        const result = await tool.run(p, (msg.params?.arguments as Record<string, unknown>) ?? {});
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: Array.isArray(result) ? { items: result } : result };
      } catch (e) {
        if (e instanceof HttpError) return { content: [{ type: "text", text: e.message }], isError: true };
        throw e;
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${msg.method}`), { code: -32601 });
  }
}

export async function POST(req: NextRequest) {
  let principal: api.Principal;
  try {
    principal = await api.authenticate(req);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 401;
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: e instanceof Error ? e.message : "Unauthorized" } }, { status, headers: { "www-authenticate": "Bearer" } });
  }
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const batch = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of batch) {
    if (msg.id === undefined || msg.id === null) continue; // notification
    try {
      responses.push({ jsonrpc: "2.0", id: msg.id, result: await dispatch(principal, msg) });
    } catch (e) {
      const code = (e as { code?: number }).code ?? -32603;
      if (code === -32603) console.error(e);
      responses.push({ jsonrpc: "2.0", id: msg.id, error: { code, message: e instanceof Error ? e.message : "Internal error" } });
    }
  }
  if (!responses.length) return new NextResponse(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0], { headers: { "mcp-protocol-version": PROTOCOL } });
}

export function GET() {
  return new NextResponse("This MCP server uses stateless Streamable HTTP. Send JSON-RPC requests with POST.", { status: 405, headers: { allow: "POST" } });
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
