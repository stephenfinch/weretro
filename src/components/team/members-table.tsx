"use client";

import { useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { addExistingUsersAction, removeMember, resendInvite, setMemberRole, setMemberTags } from "@/app/actions/teams";
import type { TeamMemberRow } from "@/server/queries";
import type { TeamRole } from "@/lib/types";

const ROLE_HELP: Record<TeamRole, string> = {
  admin: "Start meetings, manage members and settings",
  member: "Take part in meetings and manage actions",
  observer: "View meetings without taking part",
};

export function MembersTable({ teamId, members, canManage, meId, orgPeople, canAdd }: { teamId: string; members: TeamMemberRow[]; canManage: boolean; meId: string; orgPeople: { userId: string; name: string; email: string | null }[]; canAdd: boolean }) {
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const [addId, setAddId] = useState("");
  const list = useMemo(() => members.filter((m) => `${m.name} ${m.email ?? ""} ${m.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())), [members, q]);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else if (msg) toast.success(msg);
    });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" className="h-9 w-64 pl-8" />
        </div>
        {canAdd && orgPeople.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <Select value={addId} onValueChange={setAddId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Add someone from your org…" /></SelectTrigger>
              <SelectContent>
                {orgPeople.map((p) => <SelectItem key={p.userId} value={p.userId}>{p.name} {p.email ? `(${p.email})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" disabled={!addId || pending} onClick={() => run(() => addExistingUsersAction(teamId, [addId]), "Member added")}><UserPlus /> Add</Button>
          </div>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="p-3">Member</th>
              <th className="p-3">Team role</th>
              <th className="hidden p-3 md:table-cell">Tags</th>
              <th className="hidden p-3 sm:table-cell">Last seen</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const role: TeamRole = m.roles.includes("admin") ? "admin" : m.roles.includes("member") ? "member" : "observer";
              return (
                <tr key={m.userId} className="border-t">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={m.name} color={m.color} src={m.avatarUrl} size={32} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name} {m.userId === meId && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      {m.invited && <Badge variant="outline">Invited</Badge>}
                    </div>
                  </td>
                  <td className="p-3">
                    {canManage ? (
                      <Select value={role} onValueChange={(v) => run(() => setMemberRole(teamId, m.userId, v as TeamRole), "Role updated")}>
                        <SelectTrigger size="sm" className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["admin", "member", "observer"] as TeamRole[]).map((r) => (
                            <SelectItem key={r} value={r}>
                              <span className="capitalize">{r}</span>
                              <span className="block text-[11px] text-muted-foreground">{ROLE_HELP[r]}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="capitalize">{role}</span>
                    )}
                  </td>
                  <td className="hidden p-3 md:table-cell">
                    {canManage ? (
                      <Input
                        defaultValue={m.tags.join(", ")}
                        placeholder="Add tags…"
                        className="h-8 w-48"
                        onBlur={(e) => {
                          const tags = e.target.value.split(",").map((t) => t.trim()).filter(Boolean);
                          if (tags.join(",") !== m.tags.join(",")) run(() => setMemberTags(teamId, m.userId, tags));
                        }}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-1">{m.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
                    )}
                  </td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">{m.lastSeenAt ? formatDistanceToNow(new Date(m.lastSeenAt), { addSuffix: true }) : "Never"}</td>
                  <td className="p-3 text-right">
                    {(canManage || m.userId === meId) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded p-1 hover:bg-muted" aria-label="Member options"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {m.invited && canManage && <DropdownMenuItem onSelect={() => run(() => resendInvite(teamId, m.userId), "Invitation sent")}>Resend invitation</DropdownMenuItem>}
                          <DropdownMenuItem variant="destructive" onSelect={() => confirm(m.userId === meId ? "Leave this team?" : `Remove ${m.name} from the team?`) && run(() => removeMember(teamId, m.userId), "Removed")}>
                            {m.userId === meId ? "Leave team" : "Remove from team"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
            {!list.length && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No members matching “{q}”</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
