"use client";

import { useState, useTransition } from "react";
import { Copy, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { inviteMembersAction, regenerateTeamCode } from "@/app/actions/teams";
import type { TeamRole } from "@/lib/types";

export function InviteDialog({ teamId, code, trigger, open: openProp, onOpenChange }: { teamId: string; code: string; trigger?: React.ReactNode; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = onOpenChange ?? setOpenState;
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [teamCode, setTeamCode] = useState(code);
  const [pending, start] = useTransition();
  const list = emails.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => /@/.test(e));
  const link = typeof window !== "undefined" ? `${window.location.origin}/join/${teamCode}` : `/join/${teamCode}`;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button size="sm" variant="outline">
              <UserPlus /> Invite
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>Add people by email, or share the team&apos;s invitation code.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="code">Code / link</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-3 pt-2">
            <Textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ana@company.com, ben@company.com" autoFocus />
            <div className="flex items-center gap-2">
              <Select value={role} onValueChange={(v) => setRole(v as TeamRole)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="observer">Observer</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="ml-auto"
                disabled={!list.length || pending}
                onClick={() =>
                  start(async () => {
                    const r = await inviteMembersAction(teamId, list, role);
                    if (!r.ok) return void toast.error(r.error);
                    toast.success(`Invited ${r.data?.invited.length ?? 0} ${r.data?.invited.length === 1 ? "person" : "people"}`);
                    setEmails("");
                    setOpen(false);
                  })
                }
              >
                Invite {list.length || ""} {list.length === 1 ? "member" : "members"}
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="code" className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Anyone with this code or link can join as a <strong>member</strong>.</p>
            <div className="flex items-center justify-center rounded-2xl bg-muted py-5 font-mono text-3xl font-semibold tracking-[0.2em]">{teamCode}</div>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link);
                  toast.success("Link copied");
                }}
              >
                <Copy /> Copy
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New code"
                onClick={() =>
                  start(async () => {
                    const r = await regenerateTeamCode(teamId);
                    if (r.ok && r.data) setTeamCode(r.data.code);
                    else if (!r.ok) toast.error(r.error);
                  })
                }
              >
                <RefreshCw />
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
