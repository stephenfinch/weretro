import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand";
import { currentIp } from "@/server/ip";

export const metadata = { title: "Access restricted" };

export default async function Blocked({ searchParams }: PageProps<"/blocked">) {
  const { org } = await searchParams;
  const ip = await currentIp();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-6 text-center">
      <Logo />
      <div className="max-w-md space-y-3 rounded-3xl border bg-card p-8">
        <ShieldAlert className="mx-auto size-10 text-amber-500" />
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="text-sm text-muted-foreground">
          {typeof org === "string" && org ? <><strong>{org}</strong> only allows</> : "This organization only allows"} access from approved networks. Connect to your company network or VPN and try again.
        </p>
        {ip && <p className="font-mono text-xs text-muted-foreground">Your address: {ip}</p>}
        <Link href="/home" className="inline-block text-sm text-primary hover:underline">Back to WeRetro</Link>
      </div>
    </div>
  );
}
