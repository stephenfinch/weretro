"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, X } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PALETTE } from "@/lib/constants";
import { AI_FEATURES, ATTACHMENT_KINDS } from "@/lib/org-features";
import type { OrgSettings, TeamRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteOrgAction, leaveOrgAction, revokeConnectedApp, updateOrgAction } from "@/app/actions/org";
import { ImageField, Section } from "./sections";

function useSave(orgId: string) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = (patch: Parameters<typeof updateOrgAction>[1], msg = "Saved") =>
    start(async () => {
      const r = await updateOrgAction(orgId, patch);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(msg);
        router.refresh();
      }
    });
  return { pending, save };
}

function Toggle({ label, description, checked, onChange, disabled }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-6 rounded-xl border p-4", disabled && "opacity-60")}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={() => { void navigator.clipboard.writeText(value); toast.success("Copied"); }}><Copy /></Button>
      </div>
    </div>
  );
}

// ── General ────────────────────────────────────────────────────────────────

export function OrgGeneralSection({ org }: { org: { id: string; name: string; color: string; slug: string; logoUrl: string | null; coverUrl: string | null } }) {
  const { pending, save } = useSave(org.id);
  const [name, setName] = useState(org.name);
  const [color, setColor] = useState(org.color);
  return (
    <Section title="Organization" description="Manage your organization's name, color, logo and cover image.">
      <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md" /></div>
      <div className="space-y-1.5"><Label>URL</Label><p className="font-mono text-sm text-muted-foreground">/o/{org.slug}</p></div>
      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-7 rounded-full", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} aria-label={`Color ${c}`} />)}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageField label="Logo" url={org.logoUrl} onChange={(id) => save({ logoMediaId: id }, "Logo updated")} />
        <ImageField label="Cover image" url={org.coverUrl} onChange={(id) => save({ coverMediaId: id }, "Cover updated")} />
      </div>
      <Button disabled={pending} onClick={() => save({ name, color })}>Save changes</Button>
    </Section>
  );
}

// ── Team policies ──────────────────────────────────────────────────────────

export function OrgPoliciesSection({ orgId, settings }: { orgId: string; settings: OrgSettings }) {
  const { save } = useSave(orgId);
  const [s, setS] = useState<OrgSettings>(settings);
  const set = (patch: Partial<OrgSettings>) => {
    setS({ ...s, ...patch });
    save({ settings: patch });
  };
  return (
    <div className="space-y-6">
      <Section title="Reveal team list" description="When off, people only see the teams they belong to. Owners, admins and insights viewers always see every team.">
        <Toggle label="Reveal team list" checked={s.revealTeamList !== false} onChange={(v) => set({ revealTeamList: v })} />
      </Section>
      <Section title="Team transparency" description="Give everyone in the organization a read-only view of every team's meetings, actions and insights.">
        <Toggle label="Team transparency" checked={!!s.teamTransparency} onChange={(v) => set({ teamTransparency: v })} />
      </Section>
      <Section title="Custom team request process" description="People can ask for new teams, and requests go to owners and admins. Or show your own message and link, for example to an internal ticketing system.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Custom message</Label>
            <Textarea rows={2} defaultValue={s.requestTeamCustomMessage ?? ""} onBlur={(e) => e.target.value !== (s.requestTeamCustomMessage ?? "") && set({ requestTeamCustomMessage: e.target.value })} placeholder="Shown when someone clicks Request new team" />
          </div>
          <div className="space-y-1.5">
            <Label>Custom request URL</Label>
            <Input defaultValue={s.requestTeamCustomUrl ?? ""} onBlur={(e) => e.target.value !== (s.requestTeamCustomUrl ?? "") && set({ requestTeamCustomUrl: e.target.value })} placeholder="https://intranet.example.com/request-team" />
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Roles & permissions ─────────────────────────────────────────────────────

const Yes = () => <Check className="mx-auto size-4 text-emerald-500" aria-label="Allowed" />;
const No = () => <X className="mx-auto size-4 text-muted-foreground/50" aria-label="Not allowed" />;

export function OrgRolesSection({ orgId, settings }: { orgId: string; settings: OrgSettings }) {
  const { save } = useSave(orgId);
  const [usersCreate, setUsersCreate] = useState(!settings.restrictTeamCreation);
  const [sharing, setSharing] = useState<TeamRole[]>(settings.templateSharingRoles ?? ["admin"]);
  const toggleSharing = (r: TeamRole, on: boolean) => {
    const next = on ? [...new Set([...sharing, r])] : sharing.filter((x) => x !== r);
    setSharing(next);
    save({ settings: { templateSharingRoles: next } });
  };
  return (
    <div className="space-y-6">
      <Section title="Account role permissions" description="What each organization role can do.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground uppercase">
            <tr><th className="py-2">Permission</th>{["Owner", "Admin", "User + insights", "User"].map((r) => <th key={r} className="w-24 text-center">{r}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="border-t"><td className="py-2.5">Manage organization settings and users</td><td><Yes /></td><td><Yes /></td><td><No /></td><td><No /></td></tr>
            <tr className="border-t"><td className="py-2.5">View cross-team insights</td><td><Yes /></td><td><Yes /></td><td><Yes /></td><td><No /></td></tr>
            <tr className="border-t">
              <td className="py-2.5">Create teams</td><td><Yes /></td><td><Yes /></td>
              <td className="text-center"><Switch checked={usersCreate} onCheckedChange={(v) => { setUsersCreate(v); save({ settings: { restrictTeamCreation: !v } }); }} aria-label="Users with insights can create teams" /></td>
              <td className="text-center"><Switch checked={usersCreate} onCheckedChange={(v) => { setUsersCreate(v); save({ settings: { restrictTeamCreation: !v } }); }} aria-label="Users can create teams" /></td>
            </tr>
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">When people can&apos;t create teams they can still request one.</p>
      </Section>
      <Section title="Team role permissions" description="What each team role can do across the organization. Per-team permissions are set in each team's settings.">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground uppercase">
            <tr><th className="py-2">Permission</th>{["Admin", "Member", "Observer"].map((r) => <th key={r} className="w-24 text-center">{r}</th>)}</tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-2.5">Share templates with other teams</td>
              {(["admin", "member"] as TeamRole[]).map((r) => (
                <td key={r} className="text-center"><Switch checked={sharing.includes(r)} onCheckedChange={(v) => toggleSharing(r, v)} aria-label={`${r} can share templates`} /></td>
              ))}
              <td><No /></td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  );
}

// ── AI & features ──────────────────────────────────────────────────────────

export function OrgFeaturesSection({ orgId, settings, configured, model }: { orgId: string; settings: OrgSettings; configured: boolean; model: string }) {
  const { save } = useSave(orgId);
  const [s, setS] = useState<OrgSettings>(settings);
  const aiOn = s.aiEnabled !== false;
  const groups = [...new Set(AI_FEATURES.map((f) => f.group))];
  const setAi = (key: string, v: boolean) => {
    const ai = { ...(s.ai ?? {}), [key]: v };
    setS({ ...s, ai });
    save({ settings: { ai } });
  };
  const setAttachment = (key: string, v: boolean) => {
    const attachments = { ...(s.attachments ?? {}), [key]: v };
    setS({ ...s, attachments });
    save({ settings: { attachments } });
  };
  return (
    <div className="space-y-6">
      <Section title="AI features" description="Powered by Claude. Meeting content is sent to Anthropic only to answer the request, and only when the feature is used.">
        <p className={cn("text-sm", configured ? "text-muted-foreground" : "text-amber-600")}>
          {configured ? <>Using <code className="font-mono">{model}</code>. Set <code className="font-mono">AI_MODEL</code> on the server to change it.</> : <>No <code className="font-mono">ANTHROPIC_API_KEY</code> is set on the server, so AI features are unavailable.</>}
        </p>
        <Toggle label="Enable AI" description="Turn every AI feature on or off for this organization." checked={aiOn} onChange={(v) => { setS({ ...s, aiEnabled: v }); save({ settings: { aiEnabled: v } }); }} />
        {groups.map((g) => (
          <div key={g} className="space-y-2">
            <p className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g}</p>
            {AI_FEATURES.filter((f) => f.group === g).map((f) => (
              <Toggle key={f.key} label={f.label} disabled={!aiOn} checked={aiOn && (s.ai?.[f.key] ?? f.default)} onChange={(v) => setAi(f.key, v)} />
            ))}
          </div>
        ))}
      </Section>
      <Section title="Idea and comment attachments" description="What participants can attach to retrospective ideas and comments.">
        <div className="grid gap-2 sm:grid-cols-2">
          {ATTACHMENT_KINDS.map((k) => <Toggle key={k.key} label={k.label} checked={s.attachments?.[k.key] !== false} onChange={(v) => setAttachment(k.key, v)} />)}
        </div>
      </Section>
      <Section title="Gravatar avatars" description="Show people's Gravatar picture when they haven't uploaded one. Email addresses are hashed before they're sent to Gravatar.">
        <Toggle label="Gravatar avatars" checked={!!s.gravatar} onChange={(v) => { setS({ ...s, gravatar: v }); save({ settings: { gravatar: v } }); }} />
      </Section>
    </div>
  );
}

// ── Security ───────────────────────────────────────────────────────────────

export function OrgSecuritySection({ orgId, settings, currentIp }: { orgId: string; settings: OrgSettings; currentIp: string | null }) {
  const { pending, save } = useSave(orgId);
  const [s, setS] = useState<OrgSettings>(settings);
  const [domains, setDomains] = useState((settings.allowedDomains ?? []).join(", "));
  const [ranges, setRanges] = useState((settings.allowedIpRanges ?? []).join("\n"));
  const set = (patch: Partial<OrgSettings>) => {
    setS({ ...s, ...patch });
    save({ settings: patch });
  };
  return (
    <div className="space-y-6">
      <Section title="Allowed email domains" description="Limit organization, team and meeting invitations to these email domains.">
        <div className="flex max-w-xl gap-2">
          <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="example.com, example.org" />
          <Button variant="outline" disabled={pending} onClick={() => save({ settings: { allowedDomains: domains.split(/[\s,]+/).filter(Boolean) } })}>Save</Button>
        </div>
        <Toggle label="Enforce allowed domains" description="Only people with an email address in an allowed domain can be invited or join teams." checked={!!s.enforceAllowedDomains} onChange={(v) => set({ enforceAllowedDomains: v })} />
        <Toggle label="Domain capture" description="People who sign in with a verified email in an allowed domain join this organization automatically." checked={!!s.domainCapture} onChange={(v) => set({ domainCapture: v })} />
      </Section>
      <Section title="Allowed IP ranges" description="Restrict access to this organization by IP range. People outside these ranges can't open the organization's pages or use its API, SCIM or MCP endpoints.">
        <Textarea rows={4} value={ranges} onChange={(e) => setRanges(e.target.value)} placeholder={"203.0.113.0/24\n2001:db8::/32"} className="max-w-xl font-mono text-xs" />
        <p className="text-xs text-muted-foreground">One address or CIDR range per line. Leave empty to allow any address.{currentIp && <> Your current address is <code className="font-mono">{currentIp}</code>.</>}</p>
        <Button variant="outline" disabled={pending} onClick={() => save({ settings: { allowedIpRanges: ranges.split(/[\s,]+/).filter(Boolean) } }, "IP ranges saved")}>Save IP ranges</Button>
      </Section>
      <Section title="Guests">
        <Toggle label="Allow guest participants" description="Facilitators can share a guest link so people without an account can join a meeting." checked={s.allowGuests !== false} onChange={(v) => set({ allowGuests: v })} />
      </Section>
    </div>
  );
}

// ── SSO & provisioning ─────────────────────────────────────────────────────

export function OrgSsoSection({ orgId, settings, urls }: { orgId: string; settings: OrgSettings; urls: { acs: string; entityId: string; metadata: string; login: string; scim: string } }) {
  const { pending, save } = useSave(orgId);
  const [sso, setSso] = useState(settings.sso ?? {});
  const [scim, setScim] = useState(settings.scim ?? {});
  return (
    <div className="space-y-6">
      <Section title="Single sign-on (SAML)" description="Let people sign in with your SAML identity provider, such as Okta, OneLogin, Microsoft Entra ID or Google Workspace.">
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyField label="ACS (reply) URL" value={urls.acs} />
          <CopyField label="Entity ID (audience)" value={urls.entityId} />
          <CopyField label="Service provider metadata" value={urls.metadata} />
          <CopyField label="Sign-in URL for your team" value={urls.login} />
        </div>
        <div className="space-y-1.5"><Label>Identity provider SSO URL</Label><Input value={sso.entryPoint ?? ""} onChange={(e) => setSso({ ...sso, entryPoint: e.target.value })} placeholder="https://idp.example.com/app/…/sso/saml" /></div>
        <div className="space-y-1.5"><Label>Identity provider issuer (entity ID)</Label><Input value={sso.idpIssuer ?? ""} onChange={(e) => setSso({ ...sso, idpIssuer: e.target.value })} placeholder="http://www.okta.com/…" /></div>
        <div className="space-y-1.5"><Label>Identity provider signing certificate</Label><Textarea rows={4} value={sso.idpCert ?? ""} onChange={(e) => setSso({ ...sso, idpCert: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----" className="font-mono text-xs" /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Email attribute <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={sso.emailAttribute ?? ""} onChange={(e) => setSso({ ...sso, emailAttribute: e.target.value })} placeholder="NameID" /></div>
          <div className="space-y-1.5"><Label>Name attribute <span className="font-normal text-muted-foreground">(optional)</span></Label><Input value={sso.nameAttribute ?? ""} onChange={(e) => setSso({ ...sso, nameAttribute: e.target.value })} placeholder="displayName" /></div>
        </div>
        <Toggle label="Enable SAML sign-in" checked={!!sso.enabled} onChange={(v) => setSso({ ...sso, enabled: v })} />
        <Toggle label="Require single sign-on" description="Members must sign in through your identity provider. Doesn't apply to organization owners." checked={!!sso.required} onChange={(v) => setSso({ ...sso, required: v })} disabled={!sso.enabled} />
        <Button disabled={pending} onClick={() => save({ settings: { sso } }, "Single sign-on saved")}>Save single sign-on</Button>
      </Section>
      <Section title="SCIM provisioning" description="Provision users and teams automatically from your identity provider. Create an account API key with the SCIM scope and use it as the bearer token.">
        <CopyField label="SCIM base URL" value={urls.scim} />
        <p className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Account role groups</p>
        <p className="text-xs text-muted-foreground">Members of these groups get the matching organization role. Everyone else provisioned by SCIM is a regular user.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Owners group</Label><Input value={scim.ownersGroup ?? ""} onChange={(e) => setScim({ ...scim, ownersGroup: e.target.value })} placeholder="WeRetro-Owners" /></div>
          <div className="space-y-1.5"><Label>Admins group</Label><Input value={scim.adminsGroup ?? ""} onChange={(e) => setScim({ ...scim, adminsGroup: e.target.value })} placeholder="WeRetro-Admins" /></div>
        </div>
        <p className="pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Team provisioning</p>
        <p className="text-xs text-muted-foreground">Groups matching these patterns become teams (or link to an existing team with the same name). Use <code className="font-mono">{"{team}"}</code> where the team name goes.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Team admins group pattern</Label><Input value={scim.teamAdminsPattern ?? ""} onChange={(e) => setScim({ ...scim, teamAdminsPattern: e.target.value })} placeholder="WeRetro-{team}-Admins" /></div>
          <div className="space-y-1.5"><Label>Team members group pattern</Label><Input value={scim.teamMembersPattern ?? ""} onChange={(e) => setScim({ ...scim, teamMembersPattern: e.target.value })} placeholder="WeRetro-{team}-Members" /></div>
        </div>
        <Toggle label="Allow SCIM user deactivation" description="People provisioned by SCIM who are no longer in any SCIM group lose access to the organization." checked={!!scim.allowDeactivation} onChange={(v) => setScim({ ...scim, allowDeactivation: v })} />
        <Button disabled={pending} onClick={() => save({ settings: { scim } }, "SCIM settings saved")}>Save SCIM settings</Button>
      </Section>
    </div>
  );
}

// ── API & connected apps ───────────────────────────────────────────────────

export function OrgConnectedAppsSection({ orgId, settings, grants, mcpUrl }: { orgId: string; settings: OrgSettings; grants: { id: string; clientName: string; userName: string; createdAt: Date; lastUsedAt: Date | null }[]; mcpUrl: string }) {
  const { save } = useSave(orgId);
  const [on, setOn] = useState(settings.connectedApps !== false);
  const [teamKeys, setTeamKeys] = useState(settings.teamApiKeys !== false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-6">
      <Section title="MCP & connected apps" description="Let people connect AI assistants and other MCP clients to WeRetro on their behalf. Apps sign in with OAuth and can only see what that person can see.">
        <Toggle label="Enable user-connected apps" checked={on} onChange={(v) => { setOn(v); save({ settings: { connectedApps: v } }); }} />
        <CopyField label="MCP server URL" value={mcpUrl} />
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground uppercase"><tr><th className="py-2">App</th><th>Connected by</th><th>Connected</th><th>Last used</th><th /></tr></thead>
          <tbody>
            {grants.map((g) => (
              <tr key={g.id} className="border-t">
                <td className="py-2 font-medium">{g.clientName}</td>
                <td>{g.userName}</td>
                <td className="text-muted-foreground">{formatDistanceToNow(new Date(g.createdAt), { addSuffix: true })}</td>
                <td className="text-muted-foreground">{g.lastUsedAt ? formatDistanceToNow(new Date(g.lastUsedAt), { addSuffix: true }) : "Never"}</td>
                <td className="text-right"><Button size="xs" variant="ghost" disabled={pending} onClick={() => start(async () => { const r = await revokeConnectedApp(orgId, g.id); if (!r.ok) toast.error(r.error); else { toast.success("Disconnected"); router.refresh(); } })}>Disconnect</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!grants.length && <p className="text-sm text-muted-foreground">No apps connected yet.</p>}
      </Section>
      <Section title="Team API keys" description="Let team admins create API keys scoped to their own team. Team keys get read and write access to that team only.">
        <Toggle label="Enable team-level API keys" checked={teamKeys} onChange={(v) => { setTeamKeys(v); save({ settings: { teamApiKeys: v } }); }} />
      </Section>
    </div>
  );
}

// ── Danger zone ────────────────────────────────────────────────────────────

export function OrgDangerSection({ orgId, orgName, isOwner }: { orgId: string; orgName: string; isOwner: boolean }) {
  const [confirmName, setConfirmName] = useState("");
  const [pending, start] = useTransition();
  return (
    <Section title="Danger zone">
      <div className="space-y-2">
        <p className="text-sm font-medium">Leave organization</p>
        <p className="text-sm text-muted-foreground">You&apos;ll be removed from every team in {orgName}.</p>
        <Button variant="outline" disabled={pending} onClick={() => confirm(`Leave ${orgName}?`) && start(async () => { const r = await leaveOrgAction(orgId); if (r && !r.ok) toast.error(r.error); })}>Leave organization</Button>
      </div>
      {isOwner && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Delete organization</p>
          <p className="text-sm text-muted-foreground">Deleting is permanent: it removes all teams, meetings and users from the organization. Type <strong>{orgName}</strong> to confirm.</p>
          <div className="flex max-w-md gap-2">
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            <Button variant="destructive" disabled={pending || confirmName !== orgName} onClick={() => start(async () => { const r = await deleteOrgAction(orgId, confirmName); if (r && !r.ok) toast.error(r.error); })}>Delete</Button>
          </div>
        </div>
      )}
    </Section>
  );
}
