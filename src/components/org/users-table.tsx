"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Download, MoreHorizontal, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { inviteOrgUsers, removeOrgUser, setOrgUserActive, setOrgUserRoles } from "@/app/actions/org";
import { cn } from "@/lib/utils";

export type OrgUserRow = {
  userId: string;
  name: string;
  email: string | null;
  color: string;
  avatarUrl: string | null;
  roles: string[];
  active: boolean;
  invited: boolean;
  lastSeenAt: string | null;
  teams: { id: string; name: string; admin: boolean }[];
};

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", insightsViewer: "Insights viewer", user: "User" };
type Filter = "all" | "admins" | "invited" | "deactivated";

export function UsersTable({ orgId, users, meId, isOwner, teams }: { orgId: string; users: OrgUserRow[]; meId: string; isOwner: boolean; teams: { id: string; name: string }[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [inviting, setInviting] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users
      .filter((u) => (filter === "deactivated" ? !u.active : filter === "invited" ? u.active && u.invited : filter === "admins" ? u.active && (u.roles.includes("admin") || u.roles.includes("owner")) : u.active))
      .filter((u) => !needle || u.name.toLowerCase().includes(needle) || (u.email ?? "").toLowerCase().includes(needle) || u.teams.some((t) => t.name.toLowerCase().includes(needle)));
  }, [users, q, filter]);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(msg);
        router.refresh();
      }
    });
  const toggleRole = (u: OrgUserRow, role: string) => {
    const next = u.roles.includes(role) ? u.roles.filter((r) => r !== role) : [...u.roles.filter((r) => r !== "user"), role];
    act(() => setOrgUserRoles(orgId, u.userId, next.length ? next : ["user"]), "Roles updated");
  };
  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["Name", "Email", "Roles", "Status", "Teams", "Last seen"].join(",")];
    for (const u of users) lines.push([u.name, u.email ?? "", u.roles.map((r) => ROLE_LABEL[r] ?? r).join("; "), !u.active ? "Deactivated" : u.invited ? "Invited" : "Active", u.teams.map((t) => t.name).join("; "), u.lastSeenAt ?? ""].map((v) => esc(String(v))).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "users.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  const counts: Record<Filter, number> = {
    all: users.filter((u) => u.active).length,
    admins: users.filter((u) => u.active && (u.roles.includes("admin") || u.roles.includes("owner"))).length,
    invited: users.filter((u) => u.active && u.invited).length,
    deactivated: users.filter((u) => !u.active).length,
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-xl bg-muted p-1">
          {(["all", "admins", "invited", "deactivated"] as Filter[]).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-lg px-3 py-1.5 text-sm capitalize", filter === f ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground")}>
              {f === "all" ? "Active" : f} <span className="text-xs text-muted-foreground">{counts[f]}</span>
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or team…" className="pl-8" />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download /> Export</Button>
        <Button size="sm" onClick={() => setInviting(true)}><UserPlus /> Invite users</Button>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5">User</th>
              <th className="px-2">Roles</th>
              <th className="hidden px-2 lg:table-cell">Teams</th>
              <th className="hidden px-2 md:table-cell">Last seen</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} className={cn("border-t", !u.active && "opacity-60")}>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={u.name} color={u.color} src={u.avatarUrl} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name || u.email} {u.userId === meId && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    {u.invited && u.active && <Badge variant="outline">Invited</Badge>}
                    {!u.active && <Badge variant="outline">Deactivated</Badge>}
                  </div>
                </td>
                <td className="px-2">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.filter((r) => r !== "user").map((r) => <Badge key={r} variant={r === "owner" ? "default" : "secondary"}>{ROLE_LABEL[r] ?? r}</Badge>)}
                    {u.roles.every((r) => r === "user") && <span className="text-muted-foreground">User</span>}
                  </div>
                </td>
                <td className="hidden max-w-xs px-2 lg:table-cell">
                  <p className="truncate text-muted-foreground" title={u.teams.map((t) => t.name).join(", ")}>{u.teams.length ? u.teams.map((t) => t.name + (t.admin ? " (admin)" : "")).join(", ") : "—"}</p>
                </td>
                <td className="hidden px-2 text-muted-foreground md:table-cell">{u.lastSeenAt ? formatDistanceToNow(new Date(u.lastSeenAt), { addSuffix: true }) : "Never"}</td>
                <td className="px-2 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="rounded p-1 hover:bg-muted" aria-label="User options" disabled={pending}><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Roles</DropdownMenuLabel>
                      {isOwner && <DropdownMenuCheckboxItem checked={u.roles.includes("owner")} onCheckedChange={() => toggleRole(u, "owner")}>Owner</DropdownMenuCheckboxItem>}
                      <DropdownMenuCheckboxItem checked={u.roles.includes("admin")} onCheckedChange={() => toggleRole(u, "admin")}>Admin</DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem checked={u.roles.includes("insightsViewer")} onCheckedChange={() => toggleRole(u, "insightsViewer")}>Insights viewer</DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {u.invited && u.active && u.email && <DropdownMenuItem onSelect={() => act(() => inviteOrgUsers(orgId, { emails: [u.email!] }), "Invitation sent again")}>Resend invitation</DropdownMenuItem>}
                      {u.userId !== meId && (
                        <DropdownMenuItem onSelect={() => act(() => setOrgUserActive(orgId, u.userId, !u.active), u.active ? "User deactivated" : "User reactivated")}>{u.active ? "Deactivate user" : "Reactivate user"}</DropdownMenuItem>
                      )}
                      {u.userId !== meId && (
                        <DropdownMenuItem variant="destructive" onSelect={() => confirm(`Remove ${u.name || u.email} from the organization and all its teams?`) && act(() => removeOrgUser(orgId, u.userId), "User removed")}>Remove from organization</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="p-8 text-center text-sm text-muted-foreground">No users match.</p>}
      </div>
      <p className="text-xs text-muted-foreground">Deactivated users can&apos;t sign in to this organization and are removed from its teams. Their past contributions stay in meeting history.</p>
      <InviteUsersDialog open={inviting} onOpenChange={setInviting} orgId={orgId} teams={teams} />
    </div>
  );
}

function InviteUsersDialog({ open, onOpenChange, orgId, teams }: { open: boolean; onOpenChange: (o: boolean) => void; orgId: string; teams: { id: string; name: string }[] }) {
  const [emails, setEmails] = useState("");
  const [admin, setAdmin] = useState(false);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite users</DialogTitle>
          <DialogDescription>We&apos;ll email each person a link to join the organization.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email addresses</Label>
            <Textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={4} placeholder="Separate addresses with commas, spaces or new lines" />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> Make them organization admins</label>
          {teams.length > 0 && (
            <div className="space-y-1.5">
              <Label>Add to teams (optional)</Label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
                {teams.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-muted">
                    <input type="checkbox" checked={teamIds.includes(t.id)} onChange={(e) => setTeamIds((s) => (e.target.checked ? [...s, t.id] : s.filter((x) => x !== t.id)))} />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !emails.trim()}
            onClick={() =>
              start(async () => {
                const list = emails.split(/[\s,;]+/).filter(Boolean);
                const r = await inviteOrgUsers(orgId, { emails: list, roles: admin ? ["admin"] : [], teamIds });
                if (!r.ok) return void toast.error(r.error);
                toast.success(`Invited ${r.data?.length ?? 0} ${r.data?.length === 1 ? "person" : "people"}`);
                setEmails("");
                setTeamIds([]);
                onOpenChange(false);
                router.refresh();
              })
            }
          >
            Send invitations
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
