import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { ssoOrg, ssoReady } from "@/server/sso";
import { mediaUrl } from "@/server/meetings/state";

export const metadata = { title: "Single sign-on" };

export default async function SsoOrgPage({ params, searchParams }: PageProps<"/sso/[org]">) {
  const { org: slug } = await params;
  const { next } = await searchParams;
  const org = await ssoOrg(slug).catch(() => null);
  if (!org) notFound();
  const ready = ssoReady(org);
  const href = `/api/sso/${org.id}/login${typeof next === "string" ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-6">
      <Logo />
      <div className="w-full max-w-sm space-y-4 rounded-3xl border bg-card p-8 text-center">
        {org.logoMediaId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(org.logoMediaId)!} alt="" className="mx-auto size-14 rounded-2xl object-cover" />
        ) : (
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-white" style={{ background: org.color }}>{org.name.slice(0, 1)}</span>
        )}
        <h1 className="text-lg font-semibold">Sign in to {org.name}</h1>
        {ready ? (
          <>
            <p className="text-sm text-muted-foreground">{org.settings.sso?.required ? "This organization requires single sign-on." : "Use your company account to continue."}</p>
            <Button asChild className="w-full"><a href={href}><KeyRound /> Continue with single sign-on</a></Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Single sign-on isn&apos;t set up for this organization yet.</p>
        )}
        <Link href="/login" className="block text-xs text-muted-foreground hover:text-foreground">Use another sign-in method</Link>
      </div>
    </div>
  );
}
