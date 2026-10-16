import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { getCurrentUser, type CurrentUser } from "./auth";
import { loadMeetingContext } from "./meetings/context";
import { buildMeetingState } from "./meetings/state";
import { CHECK_QUESTIONS, MEETING_TYPE_LABEL } from "@/lib/constants";
import type { MeetingStateDTO } from "@/lib/meeting-types";
import type { MeetingType } from "@/lib/types";
import { HttpError } from "./access";

export function csv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === null || c === undefined ? "" : String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\n");
}

export async function xlsx(sheets: { name: string; rows: (string | number | null | undefined)[][] }[]) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "WeRetro";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31).replace(/[\\/*?:[\]]/g, " "));
    for (const r of s.rows) ws.addRow(r.map((c) => (c === null || c === undefined ? "" : c)));
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 28));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function printableHtml(title: string, markdown: string) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = markdown
    .split("\n")
    .map((l) => {
      const h = l.match(/^(#{1,4})\s+(.*)$/);
      if (h) return `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>`;
      const b = l.match(/^(\s*)[-*]\s+(.*)$/);
      if (b) return `<li style="margin-left:${b[1].length * 8}px">${esc(b[2])}</li>`;
      if (/^\|/.test(l)) return `<pre>${esc(l)}</pre>`;
      return l.trim() ? `<p>${esc(l)}</p>` : "";
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:820px;margin:32px auto;padding:0 24px;color:#1e1b2e;line-height:1.5}h1{color:#5b4bdb}h2{border-bottom:1px solid #eee;padding-bottom:4px;margin-top:28px}li{margin:2px 0}pre{margin:0;font-size:12px}@media print{body{margin:0}}</style>
</head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`;
}

export function stateToMarkdown(s: MeetingStateDTO, opts: { withComments?: boolean } = {}) {
  const label = MEETING_TYPE_LABEL[s.meeting.type];
  const title = `${s.meeting.title || s.meeting.date} ${label}`;
  const lines: string[] = [`# ${title}`, "", `${s.team.name} · ${s.meeting.date}${s.meeting.templateName ? ` · ${s.meeting.templateName}` : ""}`, ""];
  if (s.meeting.context) lines.push("## Context", "", s.meeting.context, "");
  if (s.meeting.notes) lines.push("## Notes", "", s.meeting.notes, "");
  if (s.meeting.aiSummary) lines.push("## Summary", "", s.meeting.aiSummary, "");
  const participants = s.participants.filter((p) => !p.invited);
  if (participants.length) lines.push("## Participants", "", participants.map((p) => p.name).join(", "), "");
  for (const c of s.checks) {
    const q = CHECK_QUESTIONS.find((x) => x.key === c.question);
    if (q && c.distribution) {
      lines.push(`## Check-${c.kind}: ${q.title}`, "", q.question, "");
      q.options.forEach((o, i) => lines.push(`- ${o.emoji} ${o.label}: ${c.distribution![i]}`));
      lines.push("");
    }
  }
  const comm = (targetId: string, indent = "  ") => (opts.withComments ? s.comments.filter((c) => c.targetId === targetId).map((c) => `${indent}- 💬 ${c.authorName}: ${c.text}`) : []);
  if (s.meeting.type === "retrospective") {
    for (const t of s.meeting.topics) {
      lines.push(`## ${t.title}`, "");
      const groups = s.groups.filter((g) => g.topicId === t.id);
      for (const g of groups) {
        const ideas = s.ideas.filter((i) => i.groupId === g.id);
        lines.push(`- **${g.title || ideas.map((i) => i.text).join(" / ")}**${g.votes ? ` (${g.votes} votes)` : ""}`);
        for (const i of ideas) lines.push(`  - ${i.text}`, ...comm(i.id, "    "));
        lines.push(...comm(g.id));
      }
      for (const i of s.ideas.filter((x) => x.topicId === t.id && !x.groupId)) {
        lines.push(`- ${i.text}${i.votes ? ` (${i.votes} votes)` : ""}`, ...comm(i.id));
        if (i.poll) for (const o of i.poll.options) lines.push(`  - ${o.label}: ${o.count ?? "–"}`);
      }
      lines.push("");
    }
  }
  if (s.health) {
    lines.push(`## ${s.health.model.name}`, "", "| Dimension | Mean | Score | Responses |", "|---|---|---|---|");
    for (const d of s.health.dimensions) lines.push(`| ${d.name} | ${d.results?.mean?.toFixed(1) ?? "–"} | ${d.results?.score ?? "–"}% | ${d.results?.count ?? 0} |`);
    lines.push("");
    if (opts.withComments) for (const d of s.health.dimensions) for (const c of d.results?.comments ?? []) lines.push(`- ${d.name}: ${c.text}`);
  }
  if (s.estimation.length) {
    lines.push("## Estimation items", "");
    for (const it of s.estimation) lines.push(`- ${it.title}: **${it.finalEstimate ?? "–"}**${it.votes ? ` (votes: ${it.votes.map((v) => v.value).join(", ")})` : ""}`, ...comm(it.id));
    lines.push("");
  }
  if (s.standup.length) {
    lines.push("## Updates", "");
    const byUser = new Map<string, typeof s.standup>();
    for (const u of s.standup) byUser.set(u.participantId, [...(byUser.get(u.participantId) ?? []), u]);
    for (const [pid, ups] of byUser) {
      lines.push(`### ${s.participants.find((p) => p.id === pid)?.name ?? "Someone"}`);
      for (const t of s.meeting.topics) {
        const list = ups.filter((u) => u.topicId === t.id);
        if (!list.length) continue;
        lines.push(`- ${t.title}`);
        for (const u of list) lines.push(`  - ${u.text}`);
      }
      lines.push("");
    }
  }
  const acts = s.actions.filter((a) => a.kind === "action" && a.meetingId === s.meeting.id && a.status !== "rejected");
  lines.push("## Actions", "");
  if (!acts.length) lines.push("No actions were added.");
  for (const a of acts) lines.push(`- [${a.status === "completed" ? "x" : " "}] ${a.title}${a.assignees.length ? ` — ${a.assignees.map((u) => u.name).join(", ")}` : ""}${a.dueDate ? ` (due ${a.dueDate})` : ""}`);
  const other = s.actions.filter((a) => a.kind === "action" && a.meetingId !== s.meeting.id && a.status === "accepted");
  if (other.length) {
    lines.push("", "### Other open actions", "");
    for (const a of other) lines.push(`- [ ] ${a.title}`);
  }
  const agreements = s.actions.filter((a) => a.kind === "agreement" && a.status === "accepted");
  if (agreements.length) {
    lines.push("", "## Team agreements", "");
    for (const a of agreements) lines.push(`- ${a.title}`);
  }
  const parked = s.actions.filter((a) => a.kind === "parked" && a.status === "accepted");
  if (parked.length) {
    lines.push("", "## Parking lot", "");
    for (const a of parked) lines.push(`- ${a.title}`);
  }
  if (s.kudos.length) {
    lines.push("", "## Kudos", "");
    for (const k of s.kudos) lines.push(`- ${k.fromName} → ${k.toName}: ${k.message || k.type}`);
  }
  lines.push("", `_${s.stats.participationRate}% participation · Generated by WeRetro_`);
  return { title, markdown: lines.join("\n") };
}

export async function meetingState(meetingId: string, user?: CurrentUser | null) {
  const viewer = user ?? (await getCurrentUser());
  if (!viewer) throw new HttpError(401, "Not signed in");
  const ctx = await loadMeetingContext(meetingId, viewer);
  return buildMeetingState(ctx, viewer);
}

export async function meetingMarkdown(meetingId: string, _userId?: string, opts: { withComments?: boolean } = {}) {
  const s = await meetingState(meetingId);
  return stateToMarkdown(s, opts);
}

export async function meetingExportRows(s: MeetingStateDTO, kind: string) {
  if (kind === "ideas" || kind === "ungroupIdeas") {
    const rows: (string | number | null)[][] = [["Topic", "Group", "Idea", "Votes", "Reactions", "Comments", "Created"]];
    for (const i of s.ideas) {
      const g = s.groups.find((x) => x.id === i.groupId);
      rows.push([
        s.meeting.topics.find((t) => t.id === i.topicId)?.title ?? "",
        kind === "ideas" ? g?.title ?? "" : "",
        i.text,
        (g ? g.votes : i.votes) ?? "",
        i.reactions.map((r) => `${r.emoji}${r.count}`).join(" "),
        s.comments.filter((c) => c.targetId === i.id).map((c) => `${c.authorName}: ${c.text}`).join(" | "),
        i.createdAt,
      ]);
    }
    return rows;
  }
  if (kind === "healthRating" && s.health) {
    const rows: (string | number | null)[][] = [["Dimension", "Participant", "Rating"]];
    for (const d of s.health.dimensions) for (const r of d.results?.individual ?? []) rows.push([d.name, r.participantId ? s.participants.find((p) => p.id === r.participantId)?.name ?? "" : "Anonymous", r.value ?? "N/A"]);
    return rows;
  }
  if (kind === "healthSummary" && s.health) {
    const rows: (string | number | null)[][] = [["Dimension", "Mean", "Median", "Std dev", "Score %", "Responses", ...Array.from({ length: s.health.model.maxRating - s.health.model.minRating + 1 }, (_, i) => `Rated ${s.health!.model.minRating + i}`)]];
    for (const d of s.health.dimensions) rows.push([d.name, d.results?.mean?.toFixed(2) ?? "", d.results?.median ?? "", d.results?.stdDev?.toFixed(2) ?? "", d.results?.score ?? "", d.results?.count ?? 0, ...(d.results?.distribution ?? [])]);
    return rows;
  }
  if (kind === "estimations") {
    const rows: (string | number | null)[][] = [["Item", "Final estimate", "Average", "Votes", "Link"]];
    for (const it of s.estimation) rows.push([it.title, it.finalEstimate ?? "", it.average ?? "", it.votes?.map((v) => v.value).join(" ") ?? "", it.url ?? ""]);
    return rows;
  }
  if (kind === "updates") {
    const rows: (string | number | null)[][] = [["Person", "Question", "Status", "Update", "Created"]];
    for (const u of s.standup) rows.push([s.participants.find((p) => p.id === u.participantId)?.name ?? "", s.meeting.topics.find((t) => t.id === u.topicId)?.title ?? "", u.type ?? "", u.text, u.createdAt]);
    return rows;
  }
  // actions (default)
  const rows: (string | number | null)[][] = [["Type", "Action", "Status", "Assigned to", "Due", "Priority", "Inspired by", "Created"]];
  for (const a of s.actions.filter((x) => x.status !== "rejected")) rows.push([a.kind, a.title, a.status, a.assignees.map((u) => u.name).join(", "), a.dueDate ?? "", a.priority ?? "", a.sourceText ?? "", a.createdAt]);
  return rows;
}

export async function teamExport(teamId: string, kind: string, opts: { mine?: string } = {}) {
  const [team] = await db.select().from(schema.teams).where(eq(schema.teams.id, teamId)).limit(1);
  const items = await db
    .select()
    .from(schema.actionItems)
    .where(and(eq(schema.actionItems.teamId, teamId), isNull(schema.actionItems.deletedAt)))
    .orderBy(asc(schema.actionItems.kind), asc(schema.actionItems.position));
  const userIds = [...new Set(items.flatMap((i) => i.assigneeIds))];
  const users = userIds.length ? await db.select().from(schema.users).where(inArray(schema.users.id, userIds)) : [];
  const nm = (ids: string[]) => ids.map((id) => users.find((u) => u.id === id)?.name ?? "").join(", ");
  const filtered = items.filter((i) => {
    if (kind === "actions") return i.kind === "action" && ["accepted", "completed"].includes(i.status) && (!opts.mine || i.assigneeIds.includes(opts.mine));
    if (kind === "agreements") return i.kind === "agreement" && i.status === "accepted";
    if (kind === "parked") return i.kind === "parked" && i.status === "accepted";
    return i.status !== "rejected";
  });
  const rows: (string | number | null)[][] = [["Type", "Title", "Status", "Assigned to", "Due", "Priority", "Inspired by", "Meeting", "Created", "Completed"]];
  for (const a of filtered) rows.push([a.kind, a.title, a.status, nm(a.assigneeIds), a.dueDate ?? "", a.priority ?? "", a.sourceText ?? "", a.sourceMeetingTitle ?? "", a.createdAt.toISOString().slice(0, 10), a.completedAt?.toISOString().slice(0, 10) ?? ""]);
  const md = [
    `# ${team?.name ?? "Team"} — ${kind === "agreements" ? "Team agreements" : kind === "summary" ? "Team summary" : "Actions"}`,
    "",
    ...filtered.map((a) => `- ${a.kind === "action" ? `[${a.status === "completed" ? "x" : " "}] ` : ""}${a.title}${a.assigneeIds.length ? ` — ${nm(a.assigneeIds)}` : ""}${a.dueDate ? ` (due ${a.dueDate})` : ""}`),
  ];
  if (kind === "summary") {
    const meetings = await db.select().from(schema.meetings).where(and(eq(schema.meetings.teamId, teamId), isNull(schema.meetings.deletedAt))).orderBy(desc(schema.meetings.date)).limit(20);
    md.push("", "## Recent meetings", "", ...meetings.map((m) => `- ${m.date} ${MEETING_TYPE_LABEL[m.type as MeetingType]}: ${m.title || m.templateName || ""} (${m.status})`));
  }
  return { rows, markdown: md.join("\n"), title: `${team?.name ?? "team"}-${kind}` };
}

export async function allMeetingsWorkbook(teamId: string, user: CurrentUser) {
  const meetings = await db.select({ id: schema.meetings.id, title: schema.meetings.title, date: schema.meetings.date, type: schema.meetings.type }).from(schema.meetings).where(and(eq(schema.meetings.teamId, teamId), isNull(schema.meetings.deletedAt), eq(schema.meetings.isDemo, false))).orderBy(desc(schema.meetings.date)).limit(100);
  const sheets: { name: string; rows: (string | number | null | undefined)[][] }[] = [];
  const summary: (string | number | null)[][] = [["Date", "Type", "Title", "Ideas", "Actions", "Participation %"]];
  const ideaRows: (string | number | null)[][] = [["Date", "Meeting", "Topic", "Idea", "Votes"]];
  for (const m of meetings) {
    const s = await meetingState(m.id, user);
    summary.push([m.date, MEETING_TYPE_LABEL[m.type as MeetingType], m.title, s.stats.ideas, s.actions.filter((a) => a.meetingId === m.id && a.kind === "action").length, s.stats.participationRate]);
    for (const i of s.ideas) ideaRows.push([m.date, m.title, s.meeting.topics.find((t) => t.id === i.topicId)?.title ?? "", i.text, i.votes ?? ""]);
  }
  sheets.push({ name: "Meetings", rows: summary }, { name: "Ideas", rows: ideaRows });
  const actions = await teamExport(teamId, "all");
  sheets.push({ name: "Actions & agreements", rows: actions.rows });
  return xlsx(sheets);
}
