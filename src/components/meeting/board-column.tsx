"use client";

import type { Topic } from "@/lib/types";
import { TopicIcon } from "@/components/meeting-setup/settings-editor";
import { cn } from "@/lib/utils";

export function Board({ children }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="h-full overflow-x-auto overflow-y-hidden px-4 scrollbar-thin">
      <div className="mx-auto flex h-full w-max gap-4">{children}</div>
    </div>
  );
}

export function ColumnHeader({ topic, count }: { topic: Topic; count?: number }) {
  return (
    <div className="space-y-1 px-1 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in oklab, ${topic.color} 16%, transparent)` }}>
          <TopicIcon name={topic.icon} color={topic.color} className="size-5" />
        </span>
        <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{topic.title}</h3>
        {count !== undefined && <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{count}</span>}
      </div>
      {topic.description && <p className="line-clamp-2 text-xs text-muted-foreground">{topic.description}</p>}
    </div>
  );
}

export function Column({ topic, children, count, className, innerRef, highlight }: { topic: Topic; children: React.ReactNode; count?: number; className?: string; innerRef?: (el: HTMLElement | null) => void; highlight?: boolean }) {
  return (
    <section ref={innerRef} className={cn("flex h-full w-[300px] shrink-0 flex-col rounded-2xl transition-colors xl:w-[320px]", highlight && "bg-primary/5 ring-2 ring-primary/30", className)}>
      <ColumnHeader topic={topic} count={count} />
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-1 pb-24 scrollbar-thin">{children}</div>
    </section>
  );
}
