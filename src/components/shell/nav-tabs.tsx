"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavTabs({ items, className }: { items: { href: string; label: string; exact?: boolean; badge?: number }[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("-mb-px flex gap-1 overflow-x-auto scrollbar-thin", className)}>
      {items.map((it) => {
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {it.label}
            {!!it.badge && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{it.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
