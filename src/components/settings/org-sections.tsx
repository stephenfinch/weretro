"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PALETTE } from "@/lib/constants";
import type { OrgSettings } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deleteOrgAction, leaveOrgAction, updateOrgAction } from "@/app/actions/org";
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

export function OrgGeneralSection({ org }: { org: { id: string; name: string; color: string; slug: string; logoUrl: string | null } }) {
  const { pending, save } = useSave(org.id);
  const [name, setName] = useState(org.name);
  const [color, setColor] = useState(org.color);
  return (
    <Section title="Organization" description="Your organization's name, color and logo appear across WeRetro.">
      <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md" /></div>
      <div className="space-y-1.5"><Label>URL</Label><p className="font-mono text-sm text-muted-foreground">/o/{org.slug}</p></div>
      <div className="space-y-1.5">
        <Label>Color</Label>
        <div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-7 rounded-full", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} />)}</div>
      </div>
      <ImageField label="Logo" url={org.logoUrl} onChange={(id) => save({ logoMediaId: id }, "Logo updated")} />
      <Button disabled={pending} onClick={() => save({ name, color })}>Save changes</Button>
    </Section>
  );
}

function Toggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-6 rounded-xl border p-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function OrgSecuritySection({ orgId, settings }: { orgId: string; settings: OrgSettings }) {
  const { pending, save } = useSave(orgId);
  const [s, setS] = useState<OrgSettings>(settings);
  const [domains, setDomains] = useState((settings.allowedDomains ?? []).join(", "));
  const set = (patch: Partial<OrgSettings>) => {
    setS({ ...s, ...patch });
    save({ settings: patch });
  };
  return (
    <div className="space-y-6">
      <Section title="Allowed email domains" description="Limit who can be invited to, or join, your organization.">
        <div className="flex max-w-xl gap-2">
          <Input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="example.com, example.org" />
          <Button variant="outline" disabled={pending} onClick={() => save({ settings: { allowedDomains: domains.split(/[\s,]+/).filter(Boolean) } })}>Save</Button>
        </div>
        <Toggle label="Enforce allowed domains" description="Only people with an email address in an allowed domain can be invited or join teams." checked={!!s.enforceAllowedDomains} onChange={(v) => set({ enforceAllowedDomains: v })} />
        <Toggle label="Domain capture" description="People who sign up with an allowed domain join this organization automatically." checked={!!s.domainCapture} onChange={(v) => set({ domainCapture: v })} />
      </Section>
      <Section title="Teams">
        <Toggle label="Team transparency" description="Everyone in the organization can view every team's meetings, actions and insights (read-only)." checked={!!s.teamTransparency} onChange={(v) => set({ teamTransparency: v })} />
        <Toggle label="Restrict team creation" description="Only organization admins can create teams. Other users can request a new team." checked={!!s.restrictTeamCreation} onChange={(v) => set({ restrictTeamCreation: v })} />
        {s.restrictTeamCreation && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Custom request message (optional)</Label>
              <Textarea rows={2} defaultValue={s.requestTeamCustomMessage ?? ""} onBlur={(e) => save({ settings: { requestTeamCustomMessage: e.target.value } })} placeholder="Shown to people who request a new team" />
            </div>
            <div className="space-y-1.5">
              <Label>Custom request URL (optional)</Label>
              <Input defaultValue={s.requestTeamCustomUrl ?? ""} onBlur={(e) => save({ settings: { requestTeamCustomUrl: e.target.value } })} placeholder="https://intranet.example.com/request-team" />
            </div>
          </div>
        )}
      </Section>
      <Section title="Meetings">
        <Toggle label="Allow guest participants" description="Facilitators can share a guest link so people without an account can join a meeting." checked={s.allowGuests !== false} onChange={(v) => set({ allowGuests: v })} />
      </Section>
      <Section title="API access">
        <Toggle label="Team API keys" description="Team admins can create API keys for their own team." checked={s.teamApiKeys !== false} onChange={(v) => set({ teamApiKeys: v })} />
      </Section>
    </div>
  );
}

export function OrgAiSection({ orgId, settings, configured, model }: { orgId: string; settings: OrgSettings; configured: boolean; model: string }) {
  const { save } = useSave(orgId);
  const [on, setOn] = useState(settings.aiEnabled !== false);
  return (
    <Section title="AI features" description="Grouping suggestions, action suggestions, summaries, generated templates and health models, and the meeting assistant.">
      <Toggle label="Enable AI features" description="When off, no meeting data is sent to the AI provider." checked={on} onChange={(v) => { setOn(v); save({ settings: { aiEnabled: v } }); }} />
      <p className={cn("text-sm", configured ? "text-muted-foreground" : "text-amber-600")}>
        {configured ? <>Using Claude model <code className="font-mono">{model}</code>. Set <code className="font-mono">AI_MODEL</code> to change it.</> : <>No <code className="font-mono">ANTHROPIC_API_KEY</code> is set on the server, so AI features are unavailable.</>}
      </p>
    </Section>
  );
}

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
          <p className="text-sm text-muted-foreground">This removes all teams, meetings and users from the organization. Type <strong>{orgName}</strong> to confirm.</p>
          <div className="flex max-w-md gap-2">
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
            <Button variant="destructive" disabled={pending || confirmName !== orgName} onClick={() => start(async () => { const r = await deleteOrgAction(orgId, confirmName); if (r && !r.ok) toast.error(r.error); })}>Delete</Button>
          </div>
        </div>
      )}
    </Section>
  );
}
