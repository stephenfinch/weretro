"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { LogOut, Monitor, Moon, Sun, User, Bell, Plus, Check, Building2, HelpCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";

export function UserMenu({ user }: { user: { name: string; email: string | null; color: string; avatarUrl: string | null } }) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
        <UserAvatar name={user.name} color={user.color} src={user.avatarUrl} size={32} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="font-medium">{user.name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile"><User /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/profile/notifications"><Bell /> Notifications</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        {[
          { key: "light", label: "Light", icon: Sun },
          { key: "dark", label: "Dark", icon: Moon },
          { key: "system", label: "System", icon: Monitor },
        ].map((t) => (
          <DropdownMenuItem key={t.key} onSelect={(e) => { e.preventDefault(); setTheme(t.key); }}>
            <t.icon /> {t.label}
            {theme === t.key && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="https://github.com/" target="_blank" rel="noreferrer"><HelpCircle /> Help & source code</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href="/logout"><LogOut /> Sign out</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrgSwitcher({ orgs, current }: { orgs: { slug: string; name: string; color: string }[]; current?: { slug: string; name: string; color: string } }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium outline-none hover:bg-muted">
        <span className="flex size-6 items-center justify-center rounded-md text-[11px] font-bold text-white" style={{ background: current?.color ?? "#6366F1" }}>
          {(current?.name ?? "?").slice(0, 1).toUpperCase()}
        </span>
        <span className="max-w-40 truncate">{current?.name ?? "Select organization"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Organizations</DropdownMenuLabel>
        {orgs.map((o) => (
          <DropdownMenuItem key={o.slug} asChild>
            <Link href={`/o/${o.slug}`}>
              <Building2 /> <span className="truncate">{o.name}</span>
              {o.slug === current?.slug && <Check className="ml-auto" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding"><Plus /> New organization</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
