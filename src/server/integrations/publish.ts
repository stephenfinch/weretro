import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { appUrl } from "../auth";
import { HttpError } from "../access";
import { integrationDef } from "@/lib/integrations";
import type { PublishedRef } from "@/lib/types";

type Integration = typeof schema.integrations.$inferSelect;
type Action = typeof schema.actionItems.$inferSelect;

async function log(integrationId: string, event: string, ok: boolean, message: string) {
  await db.insert(schema.integrationLogs).values({ integrationId, event, status: ok ? "ok" : "error", message: message.slice(0, 2000) });
  await db
    .update(schema.integrations)
    .set({ status: ok ? "active" : "error", lastError: ok ? null : message.slice(0, 500) })
    .where(eq(schema.integrations.id, integrationId));
}

async function http(url: string, init: RequestInit & { json?: unknown }) {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(url, { ...init, headers, body, signal: AbortSignal.timeout(15000) });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* plain text */
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return data as Record<string, unknown>;
}

const basic = (user: string, pass: string) => `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;

function actionBody(a: Action, assignees: string[]) {
  const lines = [a.description, a.sourceText ? `Inspired by: ${a.sourceText}` : "", assignees.length ? `Assigned to: ${assignees.join(", ")}` : "", a.dueDate ? `Due: ${a.dueDate}` : "", `Created in WeRetro${a.sourceMeetingTitle ? ` (${a.sourceMeetingTitle})` : ""}`];
  return lines.filter(Boolean).join("\n\n");
}

/** Create a task in an external tool for a single action item. Returns the URL & id. */
async function createTask(i: Integration, a: Action, assignees: string[]): Promise<{ url?: string; externalId?: string }> {
  const c = i.config;
  const title = a.title.slice(0, 250);
  const body = actionBody(a, assignees);
  switch (i.type) {
    case "github": {
      const data = await http(`https://api.github.com/repos/${c.repo}/issues`, {
        method: "POST",
        headers: { authorization: `Bearer ${c.token}`, accept: "application/vnd.github+json", "user-agent": "WeRetro" },
        json: { title, body, labels: c.labels ? c.labels.split(",").map((s) => s.trim()).filter(Boolean) : undefined },
      });
      return { url: String(data.html_url), externalId: String(data.number) };
    }
    case "gitlab": {
      const base = (c.baseUrl || "https://gitlab.com").replace(/\/$/, "");
      const data = await http(`${base}/api/v4/projects/${encodeURIComponent(c.projectId)}/issues`, {
        method: "POST",
        headers: { "private-token": c.token },
        json: { title, description: body, due_date: a.dueDate ?? undefined },
      });
      return { url: String(data.web_url), externalId: String(data.iid) };
    }
    case "jira": {
      const base = c.baseUrl.replace(/\/$/, "");
      const data = await http(`${base}/rest/api/3/issue`, {
        method: "POST",
        headers: { authorization: basic(c.email, c.apiToken), accept: "application/json" },
        json: {
          fields: {
            project: { key: c.projectKey },
            summary: title,
            issuetype: { name: c.issueType || "Task" },
            description: { type: "doc", version: 1, content: body.split("\n\n").map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })) },
            ...(a.dueDate ? { duedate: a.dueDate } : {}),
          },
        },
      });
      return { url: `${base}/browse/${data.key}`, externalId: String(data.key) };
    }
    case "linear": {
      const data = await http("https://api.linear.app/graphql", {
        method: "POST",
        headers: { authorization: c.apiKey },
        json: {
          query: "mutation($input: IssueCreateInput!){ issueCreate(input:$input){ success issue { id identifier url } } }",
          variables: { input: { teamId: c.teamId, title, description: body, dueDate: a.dueDate ?? undefined } },
        },
      });
      const issue = (data as { data?: { issueCreate?: { issue?: { url: string; identifier: string } } } }).data?.issueCreate?.issue;
      if (!issue) throw new Error(JSON.stringify(data).slice(0, 300));
      return { url: issue.url, externalId: issue.identifier };
    }
    case "trello": {
      const qs = new URLSearchParams({ key: c.key, token: c.token, idList: c.listId, name: title, desc: body, ...(a.dueDate ? { due: a.dueDate } : {}) });
      const data = await http(`https://api.trello.com/1/cards?${qs}`, { method: "POST" });
      return { url: String(data.shortUrl ?? data.url), externalId: String(data.id) };
    }
    case "asana": {
      const data = await http("https://app.asana.com/api/1.0/tasks", {
        method: "POST",
        headers: { authorization: `Bearer ${c.token}` },
        json: { data: { name: title, notes: body, projects: [c.projectId], due_on: a.dueDate ?? undefined } },
      });
      const task = data.data as { gid: string; permalink_url?: string };
      return { url: task.permalink_url, externalId: task.gid };
    }
    case "clickup": {
      const data = await http(`https://api.clickup.com/api/v2/list/${c.listId}/task`, {
        method: "POST",
        headers: { authorization: c.token },
        json: { name: title, description: body, due_date: a.dueDate ? new Date(a.dueDate).getTime() : undefined },
      });
      return { url: String(data.url), externalId: String(data.id) };
    }
    case "azure": {
      const url = `https://dev.azure.com/${encodeURIComponent(c.organization)}/${encodeURIComponent(c.project)}/_apis/wit/workitems/$${encodeURIComponent(c.workItemType || "Task")}?api-version=7.0`;
      const data = await http(url, {
        method: "POST",
        headers: { authorization: basic("", c.pat), "content-type": "application/json-patch+json" },
        body: JSON.stringify([
          { op: "add", path: "/fields/System.Title", value: title },
          { op: "add", path: "/fields/System.Description", value: body.replace(/\n/g, "<br>") },
        ]),
      });
      return { url: (data._links as { html?: { href: string } })?.html?.href, externalId: String(data.id) };
    }
    case "shortcut": {
      const data = await http("https://api.app.shortcut.com/api/v3/stories", {
        method: "POST",
        headers: { "shortcut-token": c.token },
        json: { name: title, description: body, workflow_state_id: Number(c.workflowStateId), deadline: a.dueDate ? new Date(a.dueDate).toISOString() : undefined },
      });
      return { url: String(data.app_url), externalId: String(data.id) };
    }
    case "monday": {
      const data = await http("https://api.monday.com/v2", {
        method: "POST",
        headers: { authorization: c.token },
        json: { query: "mutation($board: ID!, $name: String!){ create_item(board_id:$board, item_name:$name){ id } }", variables: { board: c.boardId, name: title } },
      });
      const id = (data as { data?: { create_item?: { id: string } } }).data?.create_item?.id;
      if (!id) throw new Error(JSON.stringify(data).slice(0, 300));
      return { externalId: id };
    }
    case "basecamp": {
      const data = await http(`https://3.basecampapi.com/${c.accountId}/buckets/${c.projectId}/todolists/${c.todolistId}/todos.json`, {
        method: "POST",
        headers: { authorization: `Bearer ${c.accessToken}`, "user-agent": "WeRetro (weretro.app)" },
        json: { content: title, description: body, due_on: a.dueDate ?? undefined },
      });
      return { url: String(data.app_url), externalId: String(data.id) };
    }
    case "slack":
    case "microsoftTeams": {
      await postChat(i, `*New action:* ${title}${assignees.length ? ` — ${assignees.join(", ")}` : ""}${a.dueDate ? ` (due ${a.dueDate})` : ""}`);
      return {};
    }
    default:
      throw new Error(`${i.type} can't publish actions`);
  }
}

export async function postChat(i: Integration, text: string) {
  if (i.type === "slack") await http(i.config.webhookUrl, { method: "POST", json: { text } });
  else if (i.type === "microsoftTeams") await http(i.config.webhookUrl, { method: "POST", json: { text: text.replace(/\*/g, "**") } });
  else throw new Error("Not a chat integration");
}

async function userNames(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.select({ name: schema.users.name }).from(schema.users).where(inArray(schema.users.id, ids));
  return rows.map((r) => r.name);
}

export async function getIntegration(teamId: string, integrationId: string) {
  const [i] = await db
    .select()
    .from(schema.integrations)
    .where(and(eq(schema.integrations.id, integrationId), eq(schema.integrations.teamId, teamId)))
    .limit(1);
  if (!i) throw new HttpError(404, "Integration not found");
  return i;
}

export async function publishActions(teamId: string, integrationId: string, actionIds: string[]) {
  const i = await getIntegration(teamId, integrationId);
  const actions = actionIds.length
    ? await db
        .select()
        .from(schema.actionItems)
        .where(and(eq(schema.actionItems.teamId, teamId), inArray(schema.actionItems.id, actionIds), isNull(schema.actionItems.deletedAt)))
    : [];
  const results: { id: string; ok: boolean; url?: string; error?: string }[] = [];
  for (const a of actions) {
    if (a.published.some((p) => p.integrationId === i.id)) {
      results.push({ id: a.id, ok: true, url: a.published.find((p) => p.integrationId === i.id)?.url });
      continue;
    }
    try {
      const r = await createTask(i, a, await userNames(a.assigneeIds));
      const ref: PublishedRef = { integrationId: i.id, type: i.type, url: r.url, externalId: r.externalId, at: new Date().toISOString() };
      await db.update(schema.actionItems).set({ published: [...a.published, ref] }).where(eq(schema.actionItems.id, a.id));
      await log(i.id, "action.publish", true, `${a.title} → ${r.url ?? r.externalId ?? "ok"}`);
      results.push({ id: a.id, ok: true, url: r.url });
    } catch (e) {
      await log(i.id, "action.publish", false, String(e));
      results.push({ id: a.id, ok: false, error: String(e) });
    }
  }
  return results;
}

export async function undoPublish(teamId: string, actionId: string, integrationId: string) {
  const [a] = await db.select().from(schema.actionItems).where(and(eq(schema.actionItems.id, actionId), eq(schema.actionItems.teamId, teamId))).limit(1);
  if (!a) return;
  await db.update(schema.actionItems).set({ published: a.published.filter((p) => p.integrationId !== integrationId) }).where(eq(schema.actionItems.id, a.id));
}

export async function publishAgreements(teamId: string, integrationId: string) {
  const i = await getIntegration(teamId, integrationId);
  const items = await db
    .select()
    .from(schema.actionItems)
    .where(and(eq(schema.actionItems.teamId, teamId), eq(schema.actionItems.kind, "agreement"), eq(schema.actionItems.status, "accepted"), isNull(schema.actionItems.deletedAt)));
  const text = `*Team agreements*\n${items.map((a) => `• ${a.title}`).join("\n") || "No agreements yet"}`;
  try {
    await postChat(i, text);
    await log(i.id, "agreements.publish", true, `${items.length} agreements`);
  } catch (e) {
    await log(i.id, "agreements.publish", false, String(e));
    throw new HttpError(502, String(e));
  }
}

export async function publishSummary(teamId: string, integrationId: string, meetingId: string | null, markdown: string, title: string) {
  const i = await getIntegration(teamId, integrationId);
  try {
    if (i.type === "slack" || i.type === "microsoftTeams") {
      await postChat(i, `*${title}*\n${markdown.slice(0, 3500)}${meetingId ? `\n${appUrl(`/m/${meetingId}/report`)}` : ""}`);
    } else if (i.type === "notion") {
      const blocks = markdown
        .split("\n")
        .filter((l) => l.trim())
        .slice(0, 95)
        .map((line) => {
          const h = line.match(/^(#{1,3})\s+(.*)$/);
          if (h) {
            const t = `heading_${h[1].length}` as const;
            return { object: "block", type: t, [t]: { rich_text: [{ type: "text", text: { content: h[2].slice(0, 1900) } }] } };
          }
          const b = line.match(/^[-*]\s+(.*)$/);
          if (b) return { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: b[1].slice(0, 1900) } }] } };
          return { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 1900) } }] } };
        });
      await http("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: { authorization: `Bearer ${i.config.token}`, "notion-version": "2022-06-28" },
        json: { parent: { page_id: i.config.parentPageId }, properties: { title: { title: [{ text: { content: title } }] } }, children: blocks },
      });
    } else if (i.type === "confluence") {
      const base = i.config.baseUrl.replace(/\/$/, "");
      const html = markdownToHtml(markdown);
      await http(`${base}/wiki/rest/api/content`, {
        method: "POST",
        headers: { authorization: basic(i.config.email, i.config.apiToken) },
        json: {
          type: "page",
          title: `${title} (${new Date().toISOString().slice(0, 16).replace("T", " ")})`,
          space: { key: i.config.spaceKey },
          ...(i.config.parentId ? { ancestors: [{ id: i.config.parentId }] } : {}),
          body: { storage: { value: html, representation: "storage" } },
        },
      });
    } else {
      throw new Error(`${integrationDef(i.type)?.name ?? i.type} can't publish summaries`);
    }
    await log(i.id, "summary.publish", true, title);
  } catch (e) {
    await log(i.id, "summary.publish", false, String(e));
    throw new HttpError(502, String(e));
  }
}

function markdownToHtml(md: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const out: string[] = [];
  let inList = false;
  for (const line of md.split("\n")) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    const b = line.match(/^[-*]\s+(.*)$/);
    if (!b && inList) {
      out.push("</ul>");
      inList = false;
    }
    if (h) out.push(`<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`);
    else if (b) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${esc(b[1])}</li>`);
    } else if (line.trim()) out.push(`<p>${esc(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("");
}

/** Push a finalized estimate to whichever tool the item was imported from. */
export async function syncEstimate(itemId: string) {
  const [item] = await db.select().from(schema.estimationItems).where(eq(schema.estimationItems.id, itemId)).limit(1);
  if (!item?.externalSource || !item.externalKey || !item.finalEstimate) return { ok: false, reason: "Nothing to sync" };
  const [i] = await db
    .select()
    .from(schema.integrations)
    .where(and(eq(schema.integrations.teamId, item.teamId), eq(schema.integrations.type, item.externalSource)))
    .limit(1);
  if (!i) return { ok: false, reason: "Integration not configured" };
  const c = i.config;
  const value = item.finalEstimate;
  const numeric = Number(value);
  await db.update(schema.estimationItems).set({ syncStatus: "syncing" }).where(eq(schema.estimationItems.id, itemId));
  try {
    let status = "synced";
    if (i.type === "jira") {
      const base = c.baseUrl.replace(/\/$/, "");
      if (c.storyPointsField && Number.isFinite(numeric)) {
        await http(`${base}/rest/api/3/issue/${item.externalKey}`, { method: "PUT", headers: { authorization: basic(c.email, c.apiToken) }, json: { fields: { [c.storyPointsField]: numeric } } });
      } else {
        await http(`${base}/rest/api/3/issue/${item.externalKey}/comment`, {
          method: "POST",
          headers: { authorization: basic(c.email, c.apiToken) },
          json: { body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: `Estimated in WeRetro: ${value}` }] }] } },
        });
        status = "synced_with_comment";
      }
    } else if (i.type === "github") {
      await http(`https://api.github.com/repos/${c.repo}/issues/${item.externalKey}/comments`, {
        method: "POST",
        headers: { authorization: `Bearer ${c.token}`, accept: "application/vnd.github+json", "user-agent": "WeRetro" },
        json: { body: `Estimated in WeRetro: **${value}**` },
      });
      status = "synced_with_comment";
    } else if (i.type === "linear" && Number.isFinite(numeric)) {
      await http("https://api.linear.app/graphql", {
        method: "POST",
        headers: { authorization: c.apiKey },
        json: { query: "mutation($id: String!, $e: Int){ issueUpdate(id:$id, input:{estimate:$e}){ success } }", variables: { id: item.externalKey, e: Math.round(numeric) } },
      });
    } else if (i.type === "azure" && Number.isFinite(numeric)) {
      await http(`https://dev.azure.com/${encodeURIComponent(c.organization)}/${encodeURIComponent(c.project)}/_apis/wit/workitems/${item.externalKey}?api-version=7.0`, {
        method: "PATCH",
        headers: { authorization: basic("", c.pat), "content-type": "application/json-patch+json" },
        body: JSON.stringify([{ op: "add", path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints", value: numeric }]),
      });
    } else {
      throw new Error("Unsupported estimate sync");
    }
    await db.update(schema.estimationItems).set({ syncStatus: status }).where(eq(schema.estimationItems.id, itemId));
    await log(i.id, "estimate.sync", true, `${item.externalKey} = ${value}`);
    return { ok: true };
  } catch (e) {
    await db.update(schema.estimationItems).set({ syncStatus: "error" }).where(eq(schema.estimationItems.id, itemId));
    await log(i.id, "estimate.sync", false, String(e));
    return { ok: false, reason: String(e) };
  }
}

/** Fetch issues from an integration for estimation import. */
export async function searchIssues(teamId: string, type: string, query: { text?: string; jql?: string; wiql?: string; unestimatedOnly?: boolean }) {
  const [i] = await db
    .select()
    .from(schema.integrations)
    .where(and(eq(schema.integrations.teamId, teamId), eq(schema.integrations.type, type)))
    .limit(1);
  if (!i) throw new HttpError(400, "Integration not configured");
  const c = i.config;
  if (type === "jira") {
    const base = c.baseUrl.replace(/\/$/, "");
    const jql = query.jql || `project = ${c.projectKey}${query.text ? ` AND text ~ "${query.text.replace(/"/g, "")}"` : ""} AND statusCategory != Done ORDER BY created DESC`;
    const data = await http(`${base}/rest/api/3/search/jql`, { method: "POST", headers: { authorization: basic(c.email, c.apiToken) }, json: { jql, maxResults: 50, fields: ["summary", "status", ...(c.storyPointsField ? [c.storyPointsField] : [])] } });
    return ((data.issues as { key: string; fields: Record<string, unknown> }[]) ?? []).map((it) => ({
      key: it.key,
      title: String(it.fields.summary),
      status: (it.fields.status as { name?: string })?.name ?? "",
      points: c.storyPointsField ? (it.fields[c.storyPointsField] as number | null) : null,
      url: `${base}/browse/${it.key}`,
    }));
  }
  if (type === "github") {
    const q = `repo:${c.repo} is:issue is:open ${query.text ?? ""}`.trim();
    const data = await http(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=50`, { headers: { authorization: `Bearer ${c.token}`, accept: "application/vnd.github+json", "user-agent": "WeRetro" } });
    return ((data.items as { number: number; title: string; state: string; html_url: string }[]) ?? []).map((it) => ({ key: String(it.number), title: it.title, status: it.state, points: null, url: it.html_url }));
  }
  if (type === "linear") {
    const data = await http("https://api.linear.app/graphql", {
      method: "POST",
      headers: { authorization: c.apiKey },
      json: { query: "query($t:String!){ team(id:$t){ issues(first:50, filter:{ state:{ type:{ nin:[\"completed\",\"canceled\"] } } }){ nodes { id identifier title url estimate state { name } } } } }", variables: { t: c.teamId } },
    });
    const nodes = (data as { data?: { team?: { issues?: { nodes: { id: string; identifier: string; title: string; url: string; estimate: number | null; state: { name: string } }[] } } } }).data?.team?.issues?.nodes ?? [];
    return nodes
      .filter((n) => !query.text || n.title.toLowerCase().includes(query.text.toLowerCase()))
      .filter((n) => !query.unestimatedOnly || n.estimate === null)
      .map((n) => ({ key: n.id, title: `${n.identifier} ${n.title}`, status: n.state.name, points: n.estimate, url: n.url }));
  }
  if (type === "azure") {
    const wiql = query.wiql || `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] <> 'Done' ORDER BY [System.CreatedDate] DESC`;
    const org = encodeURIComponent(c.organization);
    const proj = encodeURIComponent(c.project);
    const res = await http(`https://dev.azure.com/${org}/${proj}/_apis/wit/wiql?api-version=7.0&$top=50`, { method: "POST", headers: { authorization: basic("", c.pat) }, json: { query: wiql } });
    const ids = ((res.workItems as { id: number }[]) ?? []).slice(0, 50).map((w) => w.id);
    if (!ids.length) return [];
    const items = await http(`https://dev.azure.com/${org}/_apis/wit/workitems?ids=${ids.join(",")}&api-version=7.0`, { headers: { authorization: basic("", c.pat) } });
    return ((items.value as { id: number; fields: Record<string, unknown> }[]) ?? []).map((w) => ({
      key: String(w.id),
      title: String(w.fields["System.Title"]),
      status: String(w.fields["System.State"]),
      points: (w.fields["Microsoft.VSTS.Scheduling.StoryPoints"] as number) ?? null,
      url: `https://dev.azure.com/${org}/${proj}/_workitems/edit/${w.id}`,
    }));
  }
  throw new HttpError(400, "Import isn't supported for this integration");
}

export async function testIntegration(i: Integration) {
  try {
    if (i.type === "slack" || i.type === "microsoftTeams") await postChat(i, "WeRetro is connected ✅");
    else if (["webhook", "n8n", "zapier"].includes(i.type)) await http(i.config.url, { method: "POST", json: { event: "test", data: { message: "WeRetro is connected" } } });
    else if (i.type === "github") await http(`https://api.github.com/repos/${i.config.repo}`, { headers: { authorization: `Bearer ${i.config.token}`, "user-agent": "WeRetro" } });
    else if (i.type === "jira") await http(`${i.config.baseUrl.replace(/\/$/, "")}/rest/api/3/myself`, { headers: { authorization: basic(i.config.email, i.config.apiToken) } });
    else if (i.type === "linear") await http("https://api.linear.app/graphql", { method: "POST", headers: { authorization: i.config.apiKey }, json: { query: "{ viewer { id } }" } });
    await log(i.id, "test", true, "Connection OK");
    return { ok: true };
  } catch (e) {
    await log(i.id, "test", false, String(e));
    return { ok: false, error: String(e) };
  }
}
