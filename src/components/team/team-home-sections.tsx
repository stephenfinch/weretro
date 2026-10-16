"use client";

import { useState, useTransition } from "react";
import { Bell, Download, Send, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { ActionDTO } from "@/lib/meeting-types";
import { TeamActionPanel } from "@/components/actions/team-action-panel";
import type { MemberLite } from "@/components/actions/action-list";
import { setReminderPreference, shareActionsByEmail } from "@/app/actions/teams";
import { PublishDialog, type IntegrationLite } from "@/components/integrations/publish-dialog";

export function TeamActionsSection({
  teamId,
  actions,
  members,
  canManage,
  canComplete,
  reminders,
  integrations,
}: {
  teamId: string;
  actions: ActionDTO[];
  members: MemberLite[];
  canManage: boolean;
  canComplete: boolean;
  reminders: string;
  integrations: IntegrationLite[];
}) {
  const [showDone, setShowDone] = useState(false);
  const [mine, setMine] = useState(false);
  const [share, setShare] = useState(false);
  const [publish, setPublish] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const [recipients, setRecipients] = useState("");
  const [scope, setScope] = useState<"all" | "assigned">("all");
  const meId = members.find((m) => m.userId)?.userId;
  void meId;
  const visible = actions.filter((a) => (showDone || a.status !== "completed") && (!mine || a.assignees.some((u) => u.id === members[0]?.userId)));
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Team actions</h2>
        <div className="ml-auto flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={() => setPublish(actions.filter((a) => a.status === "accepted").map((a) => a.id))}>
            <Send /> Publish
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setShare(true)}>
            <Share2 /> Share
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="ghost"><Download /> Download</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs text-muted-foreground">All actions</DropdownMenuLabel>
              {["csv", "xlsx", "md", "pdf"].map((f) => (
                <DropdownMenuItem key={f} asChild>
                  <a href={`/api/teams/${teamId}/export?kind=actions&format=${f}`}>{f.toUpperCase()}</a>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">My actions</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <a href={`/api/teams/${teamId}/export?kind=actions&format=csv&mine=1`}>CSV</a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a href={`/api/teams/${teamId}/export?kind=summary&format=md`}>Team summary (Markdown)</a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/teams/${teamId}/export?kind=all&format=xlsx`}>All meetings combined (Excel)</a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="Action reminder settings"><Bell /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Email me reminders when actions are due</DropdownMenuLabel>
              {[
                ["all", "All actions"],
                ["assignedToMe", "My actions only"],
                ["none", "Off"],
              ].map(([v, l]) => (
                <DropdownMenuItem key={v} onSelect={() => start(async () => void (await setReminderPreference(teamId, v as "all")))}>
                  {l} {reminders === v && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setShowDone(!showDone); }}>
                Show completed {showDone && <Check className="ml-auto" />}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setMine(!mine); }}>
                My actions only {mine && <Check className="ml-auto" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <TeamActionPanel
        teamId={teamId}
        kind="action"
        items={visible}
        members={members}
        canManage={canManage}
        canComplete={canComplete}
        onPublish={(id) => setPublish([id])}
      />
      <Dialog open={share} onOpenChange={setShare}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share actions</DialogTitle>
            <DialogDescription>Email the team&apos;s open actions and a team summary.</DialogDescription>
          </DialogHeader>
          <Textarea rows={3} value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="Recipients: ana@company.com, ben@company.com" />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={scope === "assigned"} onCheckedChange={(v) => setScope(v ? "assigned" : "all")} /> Only assigned actions
          </label>
          <DialogFooter>
            <Button
              disabled={pending || !recipients.trim()}
              onClick={() =>
                start(async () => {
                  const r = await shareActionsByEmail(teamId, { recipients: recipients.split(/[\s,;]+/).filter(Boolean), scope });
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Actions shared");
                  setShare(false);
                })
              }
            >
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PublishDialog teamId={teamId} kind="actions" actionIds={publish ?? []} open={!!publish} onOpenChange={(o) => !o && setPublish(null)} integrations={integrations} />
    </section>
  );
}

export function TeamListSection({
  teamId,
  kind,
  title,
  items,
  members,
  canManage,
  integrations,
}: {
  teamId: string;
  kind: "agreement" | "parked";
  title: string;
  items: ActionDTO[];
  members: MemberLite[];
  canManage: boolean;
  integrations: IntegrationLite[];
}) {
  const [publish, setPublish] = useState(false);
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        {kind === "agreement" && (
          <div className="ml-auto flex items-center gap-1">
            <Button size="xs" variant="ghost" onClick={() => setPublish(true)}>
              <Send /> Publish
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="xs" variant="ghost"><Download /> Download</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {["csv", "xlsx", "md", "pdf"].map((f) => (
                  <DropdownMenuItem key={f} asChild>
                    <a href={`/api/teams/${teamId}/export?kind=agreements&format=${f}`}>{f.toUpperCase()}</a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      <TeamActionPanel teamId={teamId} kind={kind} items={items} members={members} canManage={canManage} canComplete={canManage} />
      {kind === "agreement" && <PublishDialog teamId={teamId} kind="agreements" open={publish} onOpenChange={setPublish} integrations={integrations} />}
    </section>
  );
}
