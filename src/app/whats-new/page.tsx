import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Logo } from "@/components/brand";
import { CHANGELOG } from "@/lib/changelog";

export const metadata = { title: "What's new" };

export default function WhatsNew() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Logo href="/home" />
          <Link href="/home" className="ml-auto text-sm text-primary hover:underline">Back to WeRetro</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Sparkles className="size-5 text-primary" /> What&apos;s new</h1>
        {CHANGELOG.map((r) => (
          <article key={r.version} className="space-y-3 rounded-2xl border bg-card p-6">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold">{r.title}</h2>
              <span className="text-sm text-muted-foreground">v{r.version} · {r.date}</span>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {r.items.map((i) => <li key={i}>{i}</li>)}
            </ul>
          </article>
        ))}
      </main>
    </div>
  );
}
