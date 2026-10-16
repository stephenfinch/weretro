import Link from "next/link";
import { Logo } from "@/components/brand";
import { appUrl } from "@/server/auth";

export const metadata = { title: "API documentation" };

const ENDPOINTS: [string, string, string, string?][] = [
  ["GET", "/api/v1/teams", "List the teams the key can access"],
  ["GET", "/api/v1/teams/{teamId}", "Get a team"],
  ["GET", "/api/v1/teams/{teamId}/members", "List team members and their roles"],
  ["GET", "/api/v1/teams/{teamId}/actions", "List action items", "?status=accepted,completed"],
  ["POST", "/api/v1/teams/{teamId}/actions", "Create an action item", '{"title": "…", "assignees": ["ana@example.com"], "dueDate": "2026-11-01", "priority": "high"}'],
  ["GET", "/api/v1/teams/{teamId}/agreements", "List team agreements"],
  ["POST", "/api/v1/teams/{teamId}/agreements", "Create a team agreement", '{"title": "…"}'],
  ["GET", "/api/v1/teams/{teamId}/parking-lot", "List parking lot items"],
  ["POST", "/api/v1/teams/{teamId}/parking-lot", "Add a parking lot item", '{"title": "…"}'],
  ["PATCH", "/api/v1/actions/{actionId}", "Update an action, agreement or parking lot item", '{"status": "completed"}'],
  ["DELETE", "/api/v1/actions/{actionId}", "Delete an item"],
  ["GET", "/api/v1/teams/{teamId}/meetings", "List meetings", "?type=retrospective&status=closed&limit=20"],
  ["POST", "/api/v1/teams/{teamId}/meetings", "Start a meeting", '{"type": "retrospective", "templateId": "builtin:start-stop-continue"}'],
  ["GET", "/api/v1/meetings/{meetingId}", "Meeting details with a Markdown summary"],
  ["GET", "/api/v1/teams/{teamId}/health", "Health check history", "?modelId=builtin-team-radar"],
];

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-100"><code>{children}</code></pre>;
}

export default function ApiDocs() {
  const base = appUrl("");
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4">
          <Logo />
          <span className="ml-3 text-sm text-muted-foreground">API</span>
          <Link href="/home" className="ml-auto text-sm text-primary hover:underline">Open app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-10 px-4 py-10">
        <section className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">WeRetro API</h1>
          <p className="text-muted-foreground">Read and update your teams&apos; actions, agreements, meetings and health data from scripts, dashboards and AI assistants.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Authentication</h2>
          <p className="text-sm text-muted-foreground">
            Create a key in <strong>Team settings → API keys</strong> (one team) or <strong>Organization settings → API keys</strong> (every team). Keys have <code>read</code>, <code>write</code> and, for account keys, <code>scim</code> scopes. Send the key as a bearer token:
          </p>
          <Code>{`curl ${base}/api/v1/teams \\\n  -H "Authorization: Bearer wr_…"`}</Code>
          <p className="text-sm text-muted-foreground">Responses are JSON: <code>{`{ "data": … }`}</code> on success and <code>{`{ "error": { "status", "message" } }`}</code> on failure.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">REST endpoints</h2>
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <tbody>
                {ENDPOINTS.map(([method, path, desc, example]) => (
                  <tr key={method + path} className="border-b last:border-0 align-top">
                    <td className="w-20 px-3 py-2.5"><span className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold ${method === "GET" ? "bg-sky-500/15 text-sky-600" : method === "POST" ? "bg-emerald-500/15 text-emerald-600" : method === "PATCH" ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600"}`}>{method}</span></td>
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-xs">{path}</p>
                      <p className="text-muted-foreground">{desc}</p>
                      {example && <p className="mt-1 font-mono text-xs break-all text-muted-foreground">{example}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">MCP server</h2>
          <p className="text-sm text-muted-foreground">
            WeRetro is also a Model Context Protocol server, so AI assistants like Claude can list actions, read meeting summaries, create actions and start meetings. It uses the Streamable HTTP transport at <code>{base}/api/mcp</code>. Write tools only appear for keys with the <code>write</code> scope.
          </p>
<p className="text-sm text-muted-foreground">
            <strong>Sign in with OAuth (recommended).</strong> MCP clients that support OAuth discover WeRetro&apos;s authorization server automatically, open a consent screen, and act as the person who connected them, seeing only what that person can see. Admins can turn this off in Organization settings → API & connected apps, and anyone can disconnect apps from their profile.
          </p>
          <Code>{`claude mcp add --transport http weretro ${base}/api/mcp`}</Code>
          <p className="text-sm text-muted-foreground"><strong>Or use an API key</strong> as a bearer token:</p>
          <Code>{`claude mcp add --transport http weretro ${base}/api/mcp \\\n  --header "Authorization: Bearer wr_…"`}</Code>
          <p className="text-sm text-muted-foreground">Tools: <code>list_teams</code>, <code>list_team_members</code>, <code>list_actions</code>, <code>create_action</code>, <code>update_action</code>, <code>list_meetings</code>, <code>get_meeting</code>, <code>create_meeting</code>, <code>get_team_health</code>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">SCIM user provisioning</h2>
          <p className="text-sm text-muted-foreground">
            Identity providers can create, update and deactivate users through SCIM 2.0 at <code>{base}/api/scim/v2</code>. Use an account API key with the <code>scim</code> scope as the bearer token. Supported: <code>GET/POST /Users</code>, <code>GET/PUT/PATCH/DELETE /Users/{"{id}"}</code> (DELETE deactivates), filtering by <code>userName eq &quot;…&quot;</code>, <code>/ServiceProviderConfig</code> and <code>/ResourceTypes</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Add a <strong>Webhook</strong>, <strong>Zapier</strong> or <strong>n8n</strong> integration in team settings to receive events such as <code>meeting.created</code>, <code>meeting.closed</code>, <code>action.created</code>, <code>action.completed</code>, <code>agreement.created</code> and <code>standup.update</code>. Each request carries an <code>x-weretro-signature</code> header: the hex HMAC-SHA256 of the raw body using your signing secret.
          </p>
        </section>
      </main>
    </div>
  );
}
