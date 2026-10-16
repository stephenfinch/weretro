"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, MoreHorizontal, Pencil, Plug, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PALETTE, PERMISSION_LABEL, DEFAULT_PERMISSIONS, BUILTIN_DECKS } from "@/lib/constants";
import { INTEGRATIONS, integrationDef } from "@/lib/integrations";
import type { DeckCard, TeamPermissionKey, TeamRole, TemplateBody } from "@/lib/types";
import { cn } from "@/lib/utils";
import { updateTeamAction, archiveTeamAction, deleteTeamAction, restoreMeeting, restoreSeries } from "@/app/actions/teams";
import { createApiKey, deleteIntegration, integrationLogs, revokeApiKey, saveIntegration, testIntegrationAction } from "@/app/actions/integrations";
import { updateDeckScope, updateHealthModelScope, updateTemplateScope } from "@/app/actions/templates";
import { uploadImage } from "@/components/meeting/attachments";
import { DeckEditor, HealthModelEditor, TemplateEditor } from "./editors";
import { TopicIcon } from "@/components/meeting-setup/settings-editor";

export function Section({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function useAct() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (msg) toast.success(msg);
        router.refresh();
      }
    });
  return { pending, run };
}

export function ImageField({ label, url, onChange }: { label: string; url: string | null; onChange: (mediaId: string | null) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-14 rounded-xl object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-xl border border-dashed text-muted-foreground"><Upload className="size-5" /></span>
        )}
        <label className="cursor-pointer text-sm text-primary hover:underline">
          Upload
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const u = await uploadImage(f);
              if (u) onChange(u.split("/").pop()!);
            }}
          />
        </label>
        {url && <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => onChange(null)}>Remove</button>}
      </div>
    </div>
  );
}

export function GeneralSection({ team }: { team: { id: string; name: string; description: string; color: string; tags: string[]; language: string; logoUrl: string | null; coverUrl: string | null; archived: boolean } }) {
  const { pending, run } = useAct();
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description);
  const [color, setColor] = useState(team.color);
  const [tags, setTags] = useState(team.tags.join(", "));
  const [language, setLanguage] = useState(team.language);
  return (
    <div className="space-y-6">
      <Section title="Team" description="Manage your team name, logo, and tags.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Team language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{[["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"], ["nl", "Nederlands"], ["ja", "日本語"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
        <div className="space-y-1.5">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-7 rounded-full", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} />)}</div>
        </div>
        <div className="space-y-1.5"><Label>Tags</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Add tags, comma separated…" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageField label="Logo" url={team.logoUrl} onChange={(id) => run(() => updateTeamAction(team.id, { logoMediaId: id }), "Logo updated")} />
          <ImageField label="Cover image" url={team.coverUrl} onChange={(id) => run(() => updateTeamAction(team.id, { coverMediaId: id }), "Cover updated")} />
        </div>
        <Button disabled={pending} onClick={() => run(() => updateTeamAction(team.id, { name, description, color, language, tags: tags.split(",") }), "Saved")}>Save changes</Button>
      </Section>
      <Section title="Danger zone">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => (team.archived || confirm("Archive this team? It becomes read-only and its open meetings close.")) && run(() => archiveTeamAction(team.id, !team.archived), team.archived ? "Team unarchived" : "Team archived")}>
            {team.archived ? "Unarchive team" : "Archive team"}
          </Button>
          <Button variant="destructive" onClick={() => confirm("Delete this team? Deleting removes all meetings and actions.") && void deleteTeamAction(team.id)}>Delete team</Button>
        </div>
      </Section>
    </div>
  );
}

type TemplateRow = { id: string; name: string; descriptionShort: string; body: TemplateBody; teamId: string | null; sharedWithOtherTeams: boolean };

export function TemplatesSection({ teamId, orgId, meetingType, team, account, latestLink, aiEnabled, isOrgAdmin }: { teamId: string | null; orgId: string; meetingType: "retrospective" | "standup"; team: TemplateRow[]; account: TemplateRow[]; latestLink?: string; aiEnabled: boolean; isOrgAdmin: boolean }) {
  const [editing, setEditing] = useState<TemplateRow | null | "new">(null);
  const { run } = useAct();
  const card = (t: TemplateRow) => (
    <div key={t.id} className="group space-y-2 rounded-2xl border p-4">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium">{t.name}</p>
        {t.sharedWithOtherTeams && <Badge variant="secondary">Shared</Badge>}
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-0.5 hover:bg-muted" aria-label="Template options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(t)}><Pencil /> Edit template…</DropdownMenuItem>
            {t.teamId && <DropdownMenuItem onSelect={() => run(() => updateTemplateScope(t.id, { sharedWithOtherTeams: !t.sharedWithOtherTeams }))}>{t.sharedWithOtherTeams ? "Stop sharing with other teams" : "Share with other teams"}</DropdownMenuItem>}
            {t.teamId && isOrgAdmin && <DropdownMenuItem onSelect={() => run(() => updateTemplateScope(t.id, { moveToAccount: true }), "Moved")}>Move to account templates</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => confirm("Delete this template?") && run(() => updateTemplateScope(t.id, { delete: true }), "Deleted")}><Trash2 /> Delete template</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{t.body.topics.map((x) => x.title).join(" · ")}</p>
      <div className="flex gap-1">{t.body.topics.slice(0, 6).map((x) => <TopicIcon key={x.id} name={x.icon} color={x.color} className="size-4" />)}</div>
    </div>
  );
  return (
    <div className="space-y-6">
      <Section title={teamId ? "Team custom templates" : "Account-wide custom templates"} description={teamId ? "Templates created for this team only." : "Templates shared with every team in the organization."} actions={<Button size="sm" onClick={() => setEditing("new")}>New {meetingType} template</Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{team.map(card)}</div>
        {!team.length && <p className="text-sm text-muted-foreground">No custom templates yet.</p>}
      </Section>
      {teamId && account.length > 0 && (
        <Section title="Account-wide custom templates" description="Created at the organization level and shared with all teams.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{account.map(card)}</div>
        </Section>
      )}
      {latestLink && <LatestLink label={`Latest ${meetingType} link`} href={latestLink} />}
      {editing && (
        <TemplateEditor
          open
          onOpenChange={(o) => !o && setEditing(null)}
          teamId={teamId}
          orgId={orgId}
          meetingType={meetingType}
          existing={editing === "new" ? null : editing}
          custom={[...team, ...account]}
          aiEnabled={aiEnabled}
        />
      )}
    </div>
  );
}

export function LatestLink({ label, href }: { label: string; href: string }) {
  const full = typeof window !== "undefined" ? `${window.location.origin}${href}` : href;
  return (
    <Section title={label} description="This link always redirects your team to the most recent meeting.">
      <div className="flex gap-2">
        <Input readOnly value={full} className="font-mono text-xs" />
        <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(full); toast.success("Copied"); }}><Copy /> Copy</Button>
      </div>
    </Section>
  );
}

type ModelRow = { id: string; name: string; style: string; teamId: string | null; orgId: string | null; archivedAt: Date | null; dimensionNames: string[]; builtinKey: string | null };

export function HealthModelsSection({ teamId, orgId, models, defaultModelId, latestLink, aiEnabled, isOrgAdmin }: { teamId: string | null; orgId: string; models: ModelRow[]; defaultModelId: string | null; latestLink?: string; aiEnabled: boolean; isOrgAdmin: boolean }) {
  const [editing, setEditing] = useState<string | null | "new">(null);
  const { run } = useAct();
  const custom = models.filter((m) => (teamId ? m.teamId === teamId : !m.teamId && m.orgId));
  const account = models.filter((m) => teamId && !m.teamId && m.orgId);
  const card = (m: ModelRow) => (
    <div key={m.id} className={cn("space-y-2 rounded-2xl border p-4", m.archivedAt && "opacity-60")}>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium">{m.name}</p>
        <Badge variant="secondary" className="capitalize">{m.style}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-0.5 hover:bg-muted" aria-label="Model options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(m.id)}><Pencil /> Edit health model…</DropdownMenuItem>
            {m.teamId && isOrgAdmin && <DropdownMenuItem onSelect={() => run(() => updateHealthModelScope(m.id, { moveToAccount: true }), "Moved")}>Move to account health models</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => run(() => updateHealthModelScope(m.id, { archived: !m.archivedAt }))}>{m.archivedAt ? "Unarchive" : "Archive"} health model</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => confirm("Delete this health model?") && run(() => updateHealthModelScope(m.id, { delete: true }), "Deleted")}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="line-clamp-2 text-xs text-muted-foreground">{m.dimensionNames.join(" · ")}</p>
    </div>
  );
  return (
    <div className="space-y-6">
      {teamId && (
        <Section title="Team default health model" description="Selecting a default pins this health model on your team's health page.">
          <Select value={defaultModelId ?? "none"} onValueChange={(v) => run(() => updateTeamAction(teamId, { defaultHealthModelId: v === "none" ? null : v }), "Default updated")}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default</SelectItem>
              {models.filter((m) => !m.archivedAt).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Section>
      )}
      <Section title={teamId ? "Team custom health models" : "Account-wide custom health models"} actions={<Button size="sm" onClick={() => setEditing("new")}>New health model</Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{custom.map(card)}</div>
        {!custom.length && <p className="text-sm text-muted-foreground">No custom health models yet.</p>}
      </Section>
      {account.length > 0 && (
        <Section title="Account-wide custom health models">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{account.map(card)}</div>
        </Section>
      )}
      {latestLink && <LatestLink label="Latest health check link" href={latestLink} />}
      {editing && <HealthModelEditor open onOpenChange={(o) => !o && setEditing(null)} teamId={teamId} orgId={orgId} modelId={editing === "new" ? null : editing} copyOptions={models.map((m) => ({ id: m.id, name: m.name }))} aiEnabled={aiEnabled} />}
    </div>
  );
}

type DeckRow = { id: string; name: string; cards: DeckCard[]; teamId: string | null };

export function DecksSection({ teamId, orgId, decks, defaultDeckId, latestLink, isOrgAdmin }: { teamId: string | null; orgId: string; decks: DeckRow[]; defaultDeckId: string | null; latestLink?: string; isOrgAdmin: boolean }) {
  const [editing, setEditing] = useState<DeckRow | null | "new">(null);
  const { run } = useAct();
  const custom = decks.filter((d) => (teamId ? d.teamId === teamId : !d.teamId));
  const account = decks.filter((d) => teamId && !d.teamId);
  const card = (d: DeckRow) => (
    <div key={d.id} className="space-y-2 rounded-2xl border p-4">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-medium">{d.name}</p>
        <span className="text-xs text-muted-foreground">{d.cards.length} cards</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-0.5 hover:bg-muted" aria-label="Deck options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(d)}><Pencil /> Edit</DropdownMenuItem>
            {d.teamId && isOrgAdmin && <DropdownMenuItem onSelect={() => run(() => updateDeckScope(d.id, { moveToAccount: true }), "Moved")}>Move to account decks</DropdownMenuItem>}
            <DropdownMenuItem variant="destructive" onSelect={() => confirm("Delete this deck?") && run(() => updateDeckScope(d.id, { delete: true }), "Deleted")}><Trash2 /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap gap-1">{d.cards.map((c) => <span key={c.label} className="rounded-md bg-muted px-1.5 text-xs font-semibold">{c.label}</span>)}</div>
    </div>
  );
  return (
    <div className="space-y-6">
      {teamId && (
        <Section title="Team default estimation deck" description="New estimation meetings start with this deck. Facilitators can still choose another.">
          <Select value={defaultDeckId ?? "scrum"} onValueChange={(v) => run(() => updateTeamAction(teamId, { defaultDeckId: v }), "Default updated")}>
            <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
            <SelectContent>{[...BUILTIN_DECKS, ...decks].map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </Section>
      )}
      <Section title={teamId ? "Team custom estimation decks" : "Account-wide custom estimation decks"} actions={<Button size="sm" onClick={() => setEditing("new")}>New custom deck</Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{custom.map(card)}</div>
        {!custom.length && <p className="text-sm text-muted-foreground">No custom decks yet.</p>}
      </Section>
      {account.length > 0 && <Section title="Account-wide custom estimation decks"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{account.map(card)}</div></Section>}
      {latestLink && <LatestLink label="Latest estimation link" href={latestLink} />}
      {editing && <DeckEditor open onOpenChange={(o) => !o && setEditing(null)} teamId={teamId} orgId={orgId} existing={editing === "new" ? null : editing} custom={decks} />}
    </div>
  );
}

type IntegrationRow = { id: string; type: string; name: string; status: string; lastError: string | null; config: Record<string, string> };

export function IntegrationsSection({ teamId, integrations }: { teamId: string; integrations: IntegrationRow[] }) {
  const [editing, setEditing] = useState<{ type: string; row?: IntegrationRow } | null>(null);
  const [logs, setLogs] = useState<{ id: string; event: string; status: string; message: string; createdAt: Date }[] | null>(null);
  const { pending, run } = useAct();
  const groups: { kind: string; label: string }[] = [
    { kind: "tasks", label: "Project & issue tracking" },
    { kind: "chat", label: "Chat" },
    { kind: "docs", label: "Docs" },
    { kind: "automation", label: "Automation" },
  ];
  return (
    <div className="space-y-6">
      {groups.map((gp) => (
        <Section key={gp.kind} title={gp.label}>
          <div className="grid gap-3 sm:grid-cols-2">
            {INTEGRATIONS.filter((d) => d.kind === gp.kind).map((d) => {
              const rows = integrations.filter((i) => i.type === d.type);
              return (
                <div key={d.type} className="space-y-2 rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    <Plug className="size-4 text-muted-foreground" />
                    <p className="flex-1 font-medium">{d.name}</p>
                    <Button size="xs" variant={rows.length ? "outline" : "default"} onClick={() => setEditing({ type: d.type })}>Connect</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.description}</p>
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-2 py-1.5 text-sm">
                      <span className={cn("size-2 rounded-full", r.status === "active" ? "bg-emerald-500" : "bg-red-500")} />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-xs text-muted-foreground">{r.status === "active" ? "Connected" : "Error"}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-0.5 hover:bg-background" aria-label="Integration options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing({ type: d.type, row: r })}>Edit</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => run(() => testIntegrationAction(teamId, r.id), "Connection OK")}>Test connection</DropdownMenuItem>
                          <DropdownMenuItem onSelect={async () => setLogs(await integrationLogs(teamId, r.id))}>Logs</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => confirm("Remove this integration?") && run(() => deleteIntegration(teamId, r.id), "Removed")}>Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Section>
      ))}
      {editing && <IntegrationDialog teamId={teamId} type={editing.type} row={editing.row} pending={pending} onClose={() => setEditing(null)} run={run} />}
      <Dialog open={!!logs} onOpenChange={(o) => !o && setLogs(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Integration logs</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto text-sm">
            {logs?.map((l) => (
              <div key={l.id} className="flex gap-3 border-b py-2">
                <span className={cn("w-12 font-semibold", l.status === "ok" ? "text-emerald-600" : "text-red-600")}>{l.status}</span>
                <span className="w-32 text-muted-foreground">{l.event}</span>
                <span className="flex-1 break-all">{l.message}</span>
                <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(l.createdAt), { addSuffix: true })}</span>
              </div>
            ))}
            {!logs?.length && <p className="text-muted-foreground">No activity yet.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IntegrationDialog({ teamId, type, row, onClose, run, pending }: { teamId: string; type: string; row?: IntegrationRow; onClose: () => void; run: ReturnType<typeof useAct>["run"]; pending: boolean }) {
  const def = integrationDef(type)!;
  const [name, setName] = useState(row?.name ?? def.name);
  const [config, setConfig] = useState<Record<string, string>>(() => Object.fromEntries(def.fields.map((f) => [f.key, f.secret ? "" : row?.config[f.key] ?? ""])));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? "Edit" : "Connect"} {def.name}</DialogTitle>
          <DialogDescription>{def.description}. Credentials are stored for this team only.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {def.fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}{f.optional && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
              <Input type={f.secret ? "password" : "text"} value={config[f.key]} placeholder={f.secret && row ? "Leave blank to keep the current value" : f.placeholder} onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })} />
              {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => { run(() => saveIntegration(teamId, { id: row?.id, type, name, config }), "Integration saved"); onClose(); }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ApiKeysSection({ orgId, teamId, keys, disabled }: { orgId: string; teamId: string | null; keys: { id: string; name: string; prefix: string; scopes: string[]; createdAt: Date; lastUsedAt: Date | null; revokedAt: Date | null }[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [secret, setSecret] = useState<string | null>(null);
  const { pending, run } = useAct();
  const router = useRouter();
  return (
    <Section
      title={teamId ? "Team API keys" : "Account API keys"}
      description={teamId ? "Access this team's data programmatically through the REST API and MCP server." : "Access all teams in your organization through the REST API, MCP server, and SCIM."}
      actions={<Button size="sm" disabled={disabled} onClick={() => { setOpen(true); setSecret(null); setName(""); }}><KeyRound /> Create API key</Button>}
    >
      {disabled && <p className="text-sm text-amber-600">Team API keys have been disabled by your organization admin.</p>}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground uppercase"><tr><th className="py-2">Key</th><th>Scopes</th><th>Created</th><th>Last used</th><th /></tr></thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} className={cn("border-t", k.revokedAt && "opacity-50")}>
              <td className="py-2"><span className="font-medium">{k.name}</span> <span className="font-mono text-xs text-muted-foreground">{k.prefix}…</span></td>
              <td>{k.scopes.join(", ")}</td>
              <td className="text-muted-foreground">{formatDistanceToNow(new Date(k.createdAt), { addSuffix: true })}</td>
              <td className="text-muted-foreground">{k.lastUsedAt ? formatDistanceToNow(new Date(k.lastUsedAt), { addSuffix: true }) : "Never"}</td>
              <td className="text-right">{k.revokedAt ? <Badge variant="outline">Revoked</Badge> : <Button size="xs" variant="ghost" onClick={() => confirm("Revoke this key?") && run(() => revokeApiKey(k.id), "Revoked")}>Revoke</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!keys.length && <p className="text-sm text-muted-foreground">No API keys yet. See <a className="text-primary hover:underline" href="/docs/api" target="_blank">API docs</a>.</p>}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) router.refresh(); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{secret ? "Copy your key now" : "Create API key"}</DialogTitle>{secret && <DialogDescription>We won&apos;t be able to show it to you again. Keep it somewhere safe.</DialogDescription>}</DialogHeader>
          {secret ? (
            <div className="flex gap-2"><Input readOnly value={secret} className="font-mono text-xs" /><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(secret); toast.success("Copied"); }}><Copy /></Button></div>
          ) : (
            <div className="space-y-3">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, eg. Reporting script" />
              {[
                ["read", "Read", "Read-only access to members, actions, agreements, meetings and reports"],
                ["write", "Write", "Create or update meetings, actions and agreements"],
                ...(teamId ? [] : [["scim", "SCIM", "System for Cross-domain Identity Management (user provisioning)"]]),
              ].map(([v, l, d]) => (
                <label key={v} className="flex items-start gap-3 rounded-xl border p-3">
                  <input type="checkbox" className="mt-1" checked={scopes.includes(v)} onChange={(e) => setScopes((s) => (e.target.checked ? [...s, v] : s.filter((x) => x !== v)))} />
                  <span><span className="font-medium">{l}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            {secret ? (
              <Button onClick={() => setOpen(false)}><Check /> Done</Button>
            ) : (
              <Button disabled={pending || !scopes.length} onClick={async () => {
                const r = await createApiKey({ orgId, teamId, name, scopes });
                if (!r.ok) return void toast.error(r.error);
                setSecret(r.data!.secret);
              }}>Create</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

export function RolesSection({ teamId, permissions }: { teamId: string; permissions: Partial<Record<TeamPermissionKey, TeamRole[]>> }) {
  const [perms, setPerms] = useState(() => Object.fromEntries((Object.keys(PERMISSION_LABEL) as TeamPermissionKey[]).map((k) => [k, permissions[k] ?? DEFAULT_PERMISSIONS[k]])) as Record<TeamPermissionKey, TeamRole[]>);
  const { pending, run } = useAct();
  const roles: TeamRole[] = ["admin", "member", "observer"];
  return (
    <Section title="Roles & permissions" description="Choose what each team role can do.">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground uppercase"><tr><th className="py-2">Permission</th>{roles.map((r) => <th key={r} className="w-24 text-center capitalize">{r}</th>)}</tr></thead>
        <tbody>
          {(Object.keys(PERMISSION_LABEL) as TeamPermissionKey[]).map((k) => (
            <tr key={k} className="border-t">
              <td className="py-2.5">{PERMISSION_LABEL[k]}</td>
              {roles.map((r) => (
                <td key={r} className="text-center">
                  <input type="checkbox" disabled={r === "admin"} checked={r === "admin" || perms[k].includes(r)} onChange={(e) => setPerms({ ...perms, [k]: e.target.checked ? [...perms[k], r] : perms[k].filter((x) => x !== r) })} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">* These settings may be overridden by facilitators in individual meetings.</p>
      <Button disabled={pending} onClick={() => run(() => updateTeamAction(teamId, { options: { permissions: perms } }), "Permissions saved")}>Save permissions</Button>
    </Section>
  );
}

export function DeletedSection({ teamId, meetings, series }: { teamId: string; meetings: { id: string; title: string; type: string; date: string; deletedAt: Date }[]; series: { id: string; title: string; type: string; deletedAt: Date }[] }) {
  const { run } = useAct();
  const left = (d: Date) => Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
  return (
    <Section title="Recently deleted" description="Restore deleted meetings and series within 30 days. Restoring a series also restores its meetings.">
      <ul className="divide-y text-sm">
        {series.map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-2"><Badge variant="outline">Series</Badge><span className="flex-1">{s.title || s.type}</span><span className="text-muted-foreground">{left(s.deletedAt)} days left</span><Button size="xs" variant="outline" onClick={() => run(() => restoreSeries(teamId, s.id), "Restored")}><RotateCcw /> Restore</Button></li>
        ))}
        {meetings.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2"><Badge variant="secondary" className="capitalize">{m.type}</Badge><span className="flex-1">{m.title || m.date}</span><span className="text-muted-foreground">{left(m.deletedAt)} days left</span><Button size="xs" variant="outline" onClick={() => run(() => restoreMeeting(teamId, m.id), "Restored")}><RotateCcw /> Restore</Button></li>
        ))}
      </ul>
      {!meetings.length && !series.length && <p className="text-sm text-muted-foreground">Nothing deleted recently.</p>}
    </Section>
  );
}

export function NotificationsSection({ items, values, onSave }: { items: { key: string; category: string; label: string; default: boolean }[]; values: Record<string, unknown>; onSave: (v: Record<string, boolean>) => Promise<{ ok: boolean; error?: string }> }) {
  const [v, setV] = useState<Record<string, boolean>>(() => Object.fromEntries(items.map((i) => [i.key, values[i.key] === undefined ? i.default : values[i.key] === true || values[i.key] === "on"])));
  const { pending, run } = useAct();
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <Section title="Email notifications">
      {cats.map((c) => (
        <div key={c} className="space-y-2">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c}</p>
          {items.filter((i) => i.category === c).map((i) => (
            <label key={i.key} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              {i.label}
              <Switch checked={v[i.key]} onCheckedChange={(x) => setV({ ...v, [i.key]: x })} />
            </label>
          ))}
        </div>
      ))}
      <Button disabled={pending} onClick={() => run(() => onSave(v), "Preferences saved")}>Save preferences</Button>
    </Section>
  );
}
