import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Single sign-on" };

async function findOrg(form: FormData) {
  "use server";
  const q = String(form.get("q") ?? "").trim().toLowerCase();
  const next = String(form.get("next") ?? "");
  const suffix = next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : "";
  if (!q) redirect("/sso");
  if (q.includes("@")) {
    const domain = q.split("@")[1];
    const orgs = await db
      .select({ slug: schema.organizations.slug, settings: schema.organizations.settings })
      .from(schema.organizations)
      .where(sql`${schema.organizations.settings}->'sso'->>'enabled' = 'true'`);
    const match = orgs.find((o) => (o.settings.allowedDomains ?? []).includes(domain));
    if (match) redirect(`/sso/${match.slug}${suffix}`);
    redirect(`/sso?error=${encodeURIComponent("We couldn't find single sign-on for that email domain. Try your organization's URL instead.")}`);
  }
  const slug = q.replace(/^.*\/o\//, "").replace(/\/.*$/, "");
  redirect(`/sso/${encodeURIComponent(slug)}${suffix}`);
}

export default async function SsoLookup({ searchParams }: PageProps<"/sso">) {
  const sp = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Single sign-on</h1>
        <p className="text-sm text-muted-foreground">Enter your work email or your organization&apos;s WeRetro URL.</p>
      </div>
      {typeof sp.error === "string" && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{sp.error}</p>}
      <form action={findOrg} className="space-y-3">
        <input type="hidden" name="next" value={typeof sp.next === "string" ? sp.next : ""} />
        <Input name="q" placeholder="you@company.com or acme" autoFocus required />
        <Button type="submit" className="h-10 w-full">Continue</Button>
      </form>
    </div>
  );
}
