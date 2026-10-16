"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { dismissTip } from "@/app/actions/org";
import { cn } from "@/lib/utils";

export function GettingStarted({ items, total }: { items: { key: string; label: string; done: boolean; href: string; cta: string }[]; total: number }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const done = items.filter((i) => i.done).length + (total - items.length);
  if (!items.length || items.every((i) => i.done)) return null;
  return (
    <Popover>
      <PopoverTrigger className="hidden shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide whitespace-nowrap uppercase hover:bg-muted lg:flex" aria-label={`Getting started, ${done} of ${total} done`}>
        Getting started {done}/{total}
        <span className="h-1 w-10 overflow-hidden rounded-full bg-muted">
          <span className="block h-full bg-primary" style={{ width: `${(done / total) * 100}%` }} />
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Getting started</p>
        {items.map((i) => (
          <div key={i.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
            {i.done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-500" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
            <span className={cn("min-w-0 flex-1", i.done && "text-muted-foreground line-through")}>{i.label}</span>
            {!i.done && (
              <Button size="xs" variant="outline" asChild>
                <Link href={i.href}>{i.cta}</Link>
              </Button>
            )}
            <button
              type="button"
              disabled={pending}
              aria-label={`Dismiss ${i.label}`}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => start(async () => { await dismissTip(i.key); router.refresh(); })}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
