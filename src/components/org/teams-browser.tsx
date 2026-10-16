"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Archive, MoreHorizontal, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TeamLogo } from "@/components/team/team-card";
import { CreateTeamDialog } from "@/components/team/create-team-dialog";
import { archiveTeamAction, deleteTeamAction, joinTeamAction, requestTeamAccess } from "@/app/actions/teams";
import { cn } from "@/lib/utils";

export type OrgTeamRow = {
  id: string;
  name: string;
  color: string;
  logoUrl: string | null;
  description: string;
  tags: string[];
  isProgram: boolean;
  archived: boolean;
  memberCount: number;
  lastActivityAt: string | null;
  myRole: "admin" | "member" | "observer" | null;
  requested: boolean;
  visible: boolean;
};

type Tab = "all" | "mine" | "programs" | "archived";

export function TeamsBrowser({ orgId, teams, isAdmin, canCreate, transparency }: { orgId: string; teams: OrgTeamRow[]; isAdmin: boolean; canCreate: boolean; transparency: boolean }) {
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const counts = {
    all: teams.filter((t) => !t.archived && !t.isProgram).length,
    mine: teams.filter((t) => !t.archived && t.myRole).length,
    programs: teams.filter((t) => !t.archived && t.isProgram).length,
    archived: teams.filter((t) => t.archived).length,
  };
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return teams
      .filter((t) => (tab === "archived" ? t.archived : !t.archived))
      .filter((t) => (tab === "mine" ? !!t.myRole : tab === "programs" ? t.isProgram : tab === "all" ? !t.isProgram : true))
      .filter((t) => !needle || t.name.toLowerCase().includes(needle) || t.tags.some((x) => x.toLowerCase().includes(needle)) || t.description.toLowerCase().includes(needle));
  }, [teams, tab, q]);
  const act = (fn: () => Promise<{ ok: boolean; error?: string } | void>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok) toast.error(r.error);
      else {
        toast.success(msg);
        router.refresh();
      }
    });
  const tabs: [Tab, string][] = [
    ["all", "All teams"],
    ["mine", "My teams"],
    ["programs", "Programs"],
    ...(isAdmin ? ([["archived", "Archived"]] as [Tab, string][]) : []),
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={cn("rounded-lg px-3 py-1.5 text-sm", tab === key ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {label} <span className="text-xs text-muted-foreground">{counts[key]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams or tags…" className="pl-8" />
        </div>
        <CreateTeamDialog orgId={orgId} canCreate={canCreate} />
        {isAdmin && <CreateTeamDialog orgId={orgId} canCreate program teams={teams.filter((t) => !t.isProgram && !t.archived).map((t) => ({ id: t.id, name: t.name }))} trigger={<Button variant="outline" size="sm">New program</Button>} />}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5">Team</th>
              <th className="hidden px-2 md:table-cell">Members</th>
              <th className="hidden px-2 md:table-cell">Last activity</th>
              <th className="px-2">Your role</th>
              <th className="w-40" />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <TeamLogo name={t.name} color={t.color} logoUrl={t.logoUrl} size={36} />
                    <div className="min-w-0">
                      {t.visible ? (
                        <Link href={`/t/${t.id}`} className="font-medium hover:underline">{t.name}</Link>
                      ) : (
                        <span className="font-medium">{t.name}</span>
                      )}
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        {t.isProgram && <Badge variant="outline">Program</Badge>}
                        {t.archived && <Badge variant="outline"><Archive /> Archived</Badge>}
                        {t.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                        {t.description && <span className="truncate">{t.description}</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden px-2 text-muted-foreground md:table-cell"><Users className="mr-1 inline size-3.5" />{t.memberCount}</td>
                <td className="hidden px-2 text-muted-foreground md:table-cell">{t.lastActivityAt ? formatDistanceToNow(new Date(t.lastActivityAt), { addSuffix: true }) : "—"}</td>
                <td className="px-2">{t.myRole ? <Badge variant={t.myRole === "admin" ? "default" : "secondary"} className="capitalize">{t.myRole}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!t.myRole && !t.archived && (isAdmin ? (
                      <Button size="xs" variant="outline" disabled={pending} onClick={() => act(() => joinTeamAction(t.id), `Joined ${t.name}`)}>Join</Button>
                    ) : t.requested ? (
                      <span className="text-xs text-muted-foreground">Requested</span>
                    ) : (
                      <Button size="xs" variant="outline" disabled={pending} onClick={() => act(() => requestTeamAccess(t.id, "member"), "Request sent to the team admins")}>Request to join</Button>
                    ))}
                    {(isAdmin || t.myRole === "admin") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 hover:bg-muted" aria-label="Team options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild><Link href={`/t/${t.id}/settings`}>Team settings</Link></DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/t/${t.id}/members`}>Manage members</Link></DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => act(() => archiveTeamAction(t.id, !t.archived), t.archived ? "Team unarchived" : "Team archived")}>{t.archived ? "Unarchive team" : "Archive team"}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => confirm(`Delete ${t.name}? All its meetings and actions are removed.`) && start(() => deleteTeamAction(t.id))}>Delete team</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">{q ? "No teams match your search." : tab === "programs" ? "No programs yet. Programs group several teams so you can see their insights together." : "No teams here."}</p>}
      </div>
      {!isAdmin && !transparency && <p className="text-xs text-muted-foreground">You can open teams you belong to. Request to join any other team.</p>}
    </div>
  );
}
