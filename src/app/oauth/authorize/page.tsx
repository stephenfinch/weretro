import { redirect } from "next/navigation";
import { CheckCircle2, PlugZap } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getCurrentUser, requireUser } from "@/server/auth";
import { listUserOrgs } from "@/server/access";
import { getClient, issueCode, SCOPES } from "@/server/oauth-server";

export const metadata = { title: "Connect an app" };

type Params = { response_type?: string; client_id?: string; redirect_uri?: string; code_challenge?: string; code_challenge_method?: string; state?: string; scope?: string };

function back(uri: string, params: Record<string, string | undefined>) {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

function scopesFrom(scope?: string) {
  const asked = (scope ?? "").split(/\s+/).filter((s) => SCOPES.includes(s));
  return asked.length ? asked : ["read", "write"];
}

async function decide(form: FormData) {
  "use server";
  const user = await requireUser();
  const p = Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) as Params & { orgId?: string; decision?: string };
  const client = p.client_id ? await getClient(p.client_id) : null;
  if (!client || !p.redirect_uri || !client.redirectUris.includes(p.redirect_uri)) redirect("/home");
  if (p.decision !== "allow") redirect(back(p.redirect_uri, { error: "access_denied", state: p.state }));
  const orgs = (await listUserOrgs(user.id)).filter((o) => o.org.settings.connectedApps !== false);
  const org = orgs.find((o) => o.org.id === p.orgId);
  if (!org) redirect(back(p.redirect_uri, { error: "access_denied", error_description: "No organization selected", state: p.state }));
  const code = await issueCode({ clientId: client.id, userId: user.id, orgId: org.org.id, redirectUri: p.redirect_uri, codeChallenge: p.code_challenge ?? "", scope: scopesFrom(p.scope).join(" ") });
  redirect(back(p.redirect_uri, { code, state: p.state }));
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-6">
      <Logo />
      <div className="w-full max-w-md space-y-5 rounded-3xl border bg-card p-8">{children}</div>
    </div>
  );
}

export default async function Authorize({ searchParams }: PageProps<"/oauth/authorize">) {
  const sp = (await searchParams) as Params;
  const client = sp.client_id ? await getClient(sp.client_id) : null;
  if (!client || !sp.redirect_uri || !client.redirectUris.includes(sp.redirect_uri)) {
    return (
      <Shell>
        <h1 className="text-lg font-semibold">This app can&apos;t connect</h1>
        <p className="text-sm text-muted-foreground">The app sent an unknown client or redirect address. Try connecting again from the app.</p>
      </Shell>
    );
  }
  if (sp.response_type !== "code" || sp.code_challenge_method !== "S256" || !sp.code_challenge) {
    redirect(back(sp.redirect_uri, { error: "invalid_request", error_description: "PKCE with S256 is required", state: sp.state }));
  }
  const user = await getCurrentUser();
  if (!user || user.isGuest) {
    const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${qs}`)}`);
  }
  const orgs = (await listUserOrgs(user.id)).filter((o) => o.org.settings.connectedApps !== false);
  const scopes = scopesFrom(sp.scope);
  return (
    <Shell>
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><PlugZap className="size-5" /></span>
        <div>
          <h1 className="text-lg font-semibold">Connect {client.name}</h1>
          <p className="text-sm text-muted-foreground">as {user.name} ({user.email})</p>
        </div>
      </div>
      {orgs.length ? (
        <form action={decide} className="space-y-5">
          {Object.entries(sp).map(([k, v]) => typeof v === "string" && <input key={k} type="hidden" name={k} value={v} />)}
          <div className="space-y-2 text-sm">
            <p className="font-medium">{client.name} will be able to:</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> See your teams, members, actions, meetings and health checks</li>
              {scopes.includes("write") && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> Create and update actions and start meetings for you</li>}
            </ul>
            <p className="text-xs text-muted-foreground">It can only see what you can see. You can disconnect it at any time.</p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Organization</p>
            {orgs.map((o, i) => (
              <label key={o.org.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-primary">
                <input type="radio" name="orgId" value={o.org.id} defaultChecked={i === 0} />
                <span className="flex size-6 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: o.org.color }}>{o.org.name.slice(0, 1)}</span>
                {o.org.name}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="submit" name="decision" value="deny" variant="outline" className="flex-1">Cancel</Button>
            <Button type="submit" name="decision" value="allow" className="flex-1">Allow</Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">None of your organizations allow connected apps. Ask an admin to turn them on in Organization settings → API & connected apps.</p>
      )}
    </Shell>
  );
}
