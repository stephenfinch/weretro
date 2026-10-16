"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { NotificationsSection, Section } from "@/components/settings/sections";
import { uploadImage } from "@/components/meeting/attachments";
import { changePasswordAction, deleteAccountAction, saveNotificationPrefs, updateProfileAction } from "@/app/actions/org";
import { PALETTE } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ZONES: string[] = typeof Intl !== "undefined" && "supportedValuesOf" in Intl ? (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone") : [];
const TIMEZONES = ["UTC", ...ZONES.filter((z) => z !== "UTC")];

export function ProfileForm({ user, providers, available }: { user: { name: string; email: string | null; color: string; avatarUrl: string | null; timezone: string; language: string; hasPassword: boolean }; providers: string[]; available: Record<string, boolean> }) {
  const [name, setName] = useState(user.name);
  const [color, setColor] = useState(user.color);
  const [timezone, setTimezone] = useState(user.timezone);
  const [language, setLanguage] = useState(user.language);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(msg);
        after?.();
        router.refresh();
      }
    });
  return (
    <div className="space-y-6">
      <Section title="Profile">
        <div className="flex items-center gap-4">
          <UserAvatar name={name} color={color} src={user.avatarUrl} size={64} />
          <div className="flex gap-3 text-sm">
            <label className="cursor-pointer text-primary hover:underline">
              Upload photo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const u = await uploadImage(f);
                  if (u) run(() => updateProfileAction({ avatarMediaId: u.split("/").pop()! }), "Photo updated");
                }}
              />
            </label>
            {user.avatarUrl && <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => run(() => updateProfileAction({ avatarMediaId: null }), "Photo removed")}>Remove</button>}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={user.email ?? ""} disabled /></div>
          <div className="space-y-1.5">
            <Label>Time zone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{(TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]).map((z) => <SelectItem key={z} value={z}>{z.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{[["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"], ["nl", "Nederlands"], ["ja", "日本語"]].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Avatar color</Label>
          <div className="flex flex-wrap gap-2">{PALETTE.map((c) => <button key={c} type="button" onClick={() => setColor(c)} className={cn("size-7 rounded-full", color === c && "ring-2 ring-foreground ring-offset-2 ring-offset-background")} style={{ background: c }} />)}</div>
        </div>
        <Button disabled={pending} onClick={() => run(() => updateProfileAction({ name, color, timezone, language }), "Profile saved")}>Save profile</Button>
      </Section>

      <Section title={user.hasPassword ? "Change password" : "Set a password"} description={user.hasPassword ? undefined : "You currently sign in with an email link or a connected account."}>
        <div className="grid gap-4 sm:grid-cols-2">
          {user.hasPassword && <div className="space-y-1.5"><Label>Current password</Label><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></div>}
          <div className="space-y-1.5"><Label>New password</Label><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></div>
        </div>
        <Button variant="outline" disabled={pending || next.length < 8} onClick={() => run(() => changePasswordAction(current, next), "Password updated", () => { setCurrent(""); setNext(""); })}>Update password</Button>
      </Section>

      {Object.values(available).some(Boolean) && (
        <Section title="Connected accounts" description="Sign in with one of these providers instead of a password.">
          <div className="flex flex-wrap gap-2">
            {(["google", "github", "microsoft"] as const).filter((p) => available[p]).map((p) =>
              providers.includes(p) ? (
                <span key={p} className="rounded-lg border px-3 py-1.5 text-sm capitalize">{p} · connected</span>
              ) : (
                <a key={p} href={`/api/auth/${p}/start?next=/profile`} className="rounded-lg border px-3 py-1.5 text-sm capitalize hover:bg-muted">Connect {p}</a>
              ),
            )}
          </div>
        </Section>
      )}

      <Section title="Delete account" description="Removes you from every organization and team. Your past contributions stay in meeting history without your name.">
        <div className="flex max-w-md gap-2">
          <Input value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} placeholder="Type your email to confirm" />
          <Button variant="destructive" disabled={pending || !confirmEmail} onClick={() => start(async () => { const r = await deleteAccountAction(confirmEmail); if (r && !r.ok) toast.error(r.error); })}>Delete account</Button>
        </div>
      </Section>
    </div>
  );
}

export function NotificationsForm({ items, values }: { items: { key: string; category: string; label: string; default: boolean }[]; values: Record<string, unknown> }) {
  return <NotificationsSection items={items} values={values} onSave={(v) => saveNotificationPrefs(null, v)} />;
}
