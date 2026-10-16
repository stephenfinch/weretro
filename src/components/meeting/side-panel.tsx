"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronsRight,
  Copy,
  Gift,
  Handshake,
  Info,
  ListChecks,
  MessageCircle,
  MoreHorizontal,
  PenTool,
  Plus,
  Spade,
  Trash2,
  UserPlus,
  Users,
  CheckCircle2,
  Lock,
  ExternalLink,
  NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { KUDOS_TYPES } from "@/lib/constants";
import type { ParticipantDTO } from "@/lib/meeting-types";
import { useMeeting } from "./use-meeting";
import { MeetingActionList } from "./meeting-action-list";
import { KudosDialog } from "./idea-card";
import { CommentThread } from "./comments";
import { AssistantPanel } from "./assistant";
import { EstimationItemsPanel } from "./estimation/items-panel";
import { MyStandupPanel } from "./standup/my-standup";
import { getGuestLink, inviteToMeeting } from "@/app/actions/meeting-invites";

export type PanelKey = "team" | "context" | "actions" | "agreements" | "kudos" | "whiteboards" | "chat" | "assistant" | "items" | "myStandup";

export function SidePanel({ panel, setPanel, onOpenWhiteboard }: { panel: PanelKey | null; setPanel: (p: PanelKey | null) => void; onOpenWhiteboard: (id: string) => void }) {
  const { state } = useMeeting();
  const chatCount = state.chat.length;
  const [seenChat, setSeenChat] = useState(chatCount);
  if (panel === "chat" && seenChat !== chatCount) setSeenChat(chatCount);
  const unread = panel === "chat" ? 0 : Math.max(0, chatCount - seenChat);
  const actionCount = state.actions.filter((a) => a.kind === "action" && a.status === "accepted").length;
  const isStandup = state.meeting.type === "standup";
  const rail: { key: PanelKey; icon: typeof Users; label: string; badge?: number; hidden?: boolean }[] = [
    { key: "items", icon: Spade, label: "Estimation items", badge: state.estimation.length, hidden: state.meeting.type !== "estimation" },
    { key: "myStandup", icon: NotebookPen, label: "My standup", hidden: !isStandup || !state.me.canContribute },
    { key: "team", icon: Users, label: "Team" },
    { key: "context", icon: Info, label: "Context" },
    { key: "actions", icon: ListChecks, label: "Actions", badge: actionCount },
    { key: "agreements", icon: Handshake, label: "Agreements" },
    { key: "kudos", icon: Gift, label: "Kudos", badge: state.kudos.length, hidden: state.meeting.options.kudos === false },
    { key: "whiteboards", icon: PenTool, label: "Whiteboards", badge: state.whiteboards.length },
    { key: "chat", icon: MessageCircle, label: "Chat", badge: unread, hidden: state.meeting.options.chat === "disabled" },
    { key: "assistant", icon: Bot, label: "AI assistant", hidden: !state.team.ai.assistant || state.me.isGuest },
  ];
  return (
    <div className="no-print flex h-full shrink-0">
      {panel && (
        <aside className="flex h-full w-[340px] flex-col border-l bg-background max-sm:fixed max-sm:inset-0 max-sm:z-50 max-sm:w-full">
          <div className="flex h-12 items-center gap-2 border-b px-4">
            <h2 className="font-semibold">{rail.find((r) => r.key === panel)?.label}</h2>
            <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => setPanel(null)} aria-label="Collapse panel">
              <ChevronsRight />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
            {panel === "team" && <TeamPanel />}
            {panel === "context" && <ContextPanel />}
            {panel === "actions" && <ActionsPanel />}
            {panel === "agreements" && <AgreementsPanel />}
            {panel === "kudos" && <KudosPanel />}
            {panel === "whiteboards" && <WhiteboardsPanel onOpen={onOpenWhiteboard} />}
            {panel === "chat" && <ChatPanel />}
            {panel === "assistant" && <AssistantPanel />}
            {panel === "items" && <EstimationItemsPanel />}
            {panel === "myStandup" && <MyStandupPanel />}
          </div>
        </aside>
      )}
      <nav className="flex h-full w-14 flex-col items-center gap-1 border-l bg-muted/30 py-2">
        {rail
          .filter((r) => !r.hidden)
          .map((r) => (
            <Tooltip key={r.key}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setPanel(panel === r.key ? null : r.key)}
                  className={cn("relative flex size-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground", panel === r.key && "bg-primary/10 text-primary")}
                  aria-label={r.label}
                >
                  <r.icon className="size-5" />
                  {!!r.badge && <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-primary-foreground">{r.badge}</span>}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{r.label}</TooltipContent>
            </Tooltip>
          ))}
      </nav>
    </div>
  );
}

function ParticipantRow({ p }: { p: ParticipantDTO }) {
  const { state, op } = useMeeting();
  const key = state.meeting.steps[state.meeting.stepIndex]?.key;
  const fac = state.me.isFacilitator;
  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/60">
      <span className="relative">
        <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} initials={p.initials} size={30} />
        <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-background", p.online ? "bg-emerald-500" : "bg-muted-foreground/40")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {p.name} {p.isMe && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {p.typing ? "Typing…" : p.invited ? "Invited" : p.absent ? "Absent" : p.abstained && key === "vote" ? "Abstained" : p.isFacilitating ? "Facilitating" : p.isGuest ? "Guest" : !p.online ? "Away" : ""}
        </p>
      </div>
      {key && p.finishedSteps.includes(key) && <CheckCircle2 className="size-4 text-emerald-500" />}
      {fac && !p.isMe && (
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-background" aria-label="Participant options">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Meeting role</DropdownMenuLabel>
            {(
              [
                ["facilitator", "Facilitator + participant"],
                ["facilitatorOnly", "Facilitator only"],
                ["participant", "Participant"],
                ["observer", "Observer only"],
              ] as const
            ).map(([role, label]) => (
              <DropdownMenuItem key={role} onSelect={() => void op("participant.update", { participantId: p.id, role })}>
                {label} {p.role === role && <Check className="ml-auto" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void op("participant.update", { participantId: p.id, absent: !p.absent })}>{p.absent ? "Mark present" : "Mark absent"}</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => confirm("Permanently remove this participant and their ideas, votes and comments?") && void op("participant.remove", { participantId: p.id })}>
              <Trash2 /> Remove participant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function TeamPanel() {
  const { state } = useMeeting();
  const [invite, setInvite] = useState(false);
  const facs = state.participants.filter((p) => p.role === "facilitator" || p.role === "facilitatorOnly");
  const parts = state.participants.filter((p) => p.role === "participant" || p.role === "guest");
  const obs = state.participants.filter((p) => p.role === "observer");
  const sortP = (a: ParticipantDTO, b: ParticipantDTO) => Number(b.online) - Number(a.online) || Number(a.invited) - Number(b.invited) || a.name.localeCompare(b.name);
  const anon = state.meeting.anonymity !== "names";
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl text-lg font-bold text-white" style={{ background: state.team.color }}>
          {state.team.name.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <p className="font-semibold">{state.team.name}</p>
          {anon && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" /> {state.meeting.anonymity === "anonymous" ? "Anonymous meeting" : "Using aliases"}
            </p>
          )}
        </div>
      </div>
      {state.me.canFacilitate && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setInvite(true)}>
          <UserPlus /> Invite participants
        </Button>
      )}
      <Section title={facs.length > 1 ? "Facilitators" : "Facilitator"}>
        {facs.sort(sortP).map((p) => (
          <ParticipantRow key={p.id} p={p} />
        ))}
      </Section>
      <Section title="Participants">
        {parts.sort(sortP).map((p) => (
          <ParticipantRow key={p.id} p={p} />
        ))}
        {!parts.length && <p className="px-2 text-xs text-muted-foreground">No participants yet</p>}
      </Section>
      {obs.length > 0 && (
        <Section title="Observers">
          {obs.sort(sortP).map((p) => (
            <ParticipantRow key={p.id} p={p} />
          ))}
        </Section>
      )}
      <Button variant="link" size="sm" className="w-full" onClick={() => window.open(`/m/${state.meeting.id}?view=screen`, "wr-screen", "width=1280,height=800")}>
        Open screen share window <ExternalLink />
      </Button>
      <InviteToMeetingDialog open={invite} onOpenChange={setInvite} />
    </div>
  );
}

function InviteToMeetingDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state, refresh } = useMeeting();
  const [emails, setEmails] = useState("");
  const [guest, setGuest] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite participants</DialogTitle>
          <DialogDescription>Invite team members by email, or share a guest link for people outside the team.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="email">
          <TabsList>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="guest">Guest link</TabsTrigger>
          </TabsList>
          <TabsContent value="email" className="space-y-3 pt-2">
            <Textarea rows={3} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ana@company.com, ben@company.com" />
            <p className="text-xs text-muted-foreground">They&apos;ll be added to {state.team.name} and invited to this meeting.</p>
            <Button
              onClick={async () => {
                const r = await inviteToMeeting(state.meeting.id, emails.split(/[\s,;]+/).filter(Boolean));
                if (!r.ok) return void toast.error(r.error);
                toast.success("Participants invited");
                setEmails("");
                refresh();
                onOpenChange(false);
              }}
            >
              Send invites
            </Button>
          </TabsContent>
          <TabsContent value="guest" className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">Guests can add ideas, comments and votes in this meeting only. They can&apos;t see team pages.</p>
            {guest ? (
              <div className="flex gap-2">
                <Input readOnly value={guest} className="font-mono text-xs" />
                <Button
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(guest);
                    toast.success("Guest link copied");
                  }}
                >
                  <Copy />
                </Button>
              </div>
            ) : (
              <Button
                onClick={async () => {
                  const r = await getGuestLink(state.meeting.id);
                  if (!r.ok) return void toast.error(r.error);
                  setGuest(`${window.location.origin}${r.data}`);
                }}
              >
                Create guest link
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</p>
      {children}
    </div>
  );
}

function ContextPanel() {
  const { state, op } = useMeeting();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(state.meeting.context);
  return (
    <div className="space-y-3">
      {editing ? (
        <>
          <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add context…" autoFocus />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { void op("meeting.update", { context: text }); setEditing(false); }}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </>
      ) : state.meeting.context ? (
        <p className="text-sm whitespace-pre-wrap">{state.meeting.context}</p>
      ) : (
        <p className="text-sm text-muted-foreground">No context has been added.</p>
      )}
      {state.meeting.contextImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={state.meeting.contextImageUrl} alt="" className="rounded-xl" />
      )}
      {state.me.isFacilitator && !editing && (
        <Button size="sm" variant="outline" onClick={() => { setText(state.meeting.context); setEditing(true); }}>
          <Plus /> {state.meeting.context ? "Edit context" : `Add ${state.meeting.type === "healthCheck" ? "health check" : state.meeting.type} context`}
        </Button>
      )}
      {state.meeting.templateName && <p className="pt-2 text-xs text-muted-foreground">Template: {state.meeting.templateName}</p>}
    </div>
  );
}

function ActionsPanel() {
  const { state } = useMeeting();
  const mine = state.actions.filter((a) => a.kind === "action" && a.meetingId === state.meeting.id && a.status !== "rejected");
  const other = state.actions.filter((a) => a.kind === "action" && a.meetingId !== state.meeting.id && a.status === "accepted");
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">These are the actions we agree to take as a team.</p>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase">This meeting</p>
        <MeetingActionList kind="action" items={mine} compact={false} />
      </div>
      {other.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Other open actions</p>
          <MeetingActionList kind="action" items={other} hideAdd />
        </div>
      )}
    </div>
  );
}

function AgreementsPanel() {
  const { state } = useMeeting();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">These are the things we agree on as a team.</p>
        <MeetingActionList kind="agreement" items={state.actions.filter((a) => a.kind === "agreement" && a.status !== "rejected")} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Parking lot</p>
        <p className="text-xs text-muted-foreground">These things need more discussion.</p>
        <MeetingActionList kind="parked" items={state.actions.filter((a) => a.kind === "parked" && a.status !== "rejected")} />
      </div>
    </div>
  );
}

function KudosPanel() {
  const { state, op } = useMeeting();
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Recognize your team members for their contributions.</p>
      {state.me.participantId && state.me.role !== "observer" && (
        <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
          <Gift /> Give kudos
        </Button>
      )}
      <div className="space-y-2">
        {state.kudos.map((k) => {
          const kt = KUDOS_TYPES.find((x) => x.key === k.type);
          return (
            <div key={k.id} className="group rounded-xl border p-3" style={{ background: `color-mix(in oklab, ${kt?.color ?? "#6366F1"} 8%, var(--card))` }}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{kt?.emoji}</span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">{kt?.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {k.fromName} → {k.toName}
                  </p>
                </div>
                {(k.fromUserId === state.me.userId || state.me.isFacilitator) && (
                  <button type="button" className="opacity-0 group-hover:opacity-100" onClick={() => void op("kudos.delete", { id: k.id })} aria-label="Remove kudos">
                    <Trash2 className="size-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {k.message && <p className="mt-2 text-sm">{k.message}</p>}
            </div>
          );
        })}
        {!state.kudos.length && <p className="py-4 text-center text-sm text-muted-foreground">No kudos yet</p>}
      </div>
      <KudosDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function WhiteboardsPanel({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, op } = useMeeting();
  const canCreate = (state.meeting.options.whiteboards ?? "everyone") === "everyone" ? state.me.role !== "observer" && !!state.me.participantId : state.me.isFacilitator;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Create and manage whiteboards for this meeting.</p>
      {canCreate && (
        <Button
          size="sm"
          className="w-full"
          onClick={async () => {
            const r = await op("whiteboard.create", { title: `Whiteboard ${state.whiteboards.length + 1}` });
            const id = (r.result as { id?: string } | undefined)?.id;
            if (id) onOpen(id);
          }}
        >
          <PenTool /> Create whiteboard
        </Button>
      )}
      <ul className="space-y-1.5">
        {state.whiteboards.map((w) => (
          <li key={w.id} className="group flex items-center gap-2 rounded-xl border p-2.5">
            <PenTool className="size-4 text-muted-foreground" />
            <button type="button" onClick={() => onOpen(w.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-primary">
              {w.title}
            </button>
            {w.editPermission === "creator" && <Lock className="size-3.5 text-muted-foreground" aria-label="Only creator can edit" />}
            {(w.createdById === state.me.userId || state.me.isFacilitator) && (
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded p-0.5 opacity-0 group-hover:opacity-100" aria-label="Whiteboard options">
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => { const t = prompt("Whiteboard title", w.title); if (t) void op("whiteboard.update", { id: w.id, title: t }); }}>Rename</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void op("whiteboard.update", { id: w.id, editPermission: w.editPermission === "creator" ? "everyone" : "creator" })}>
                    {w.editPermission === "creator" ? "Everyone can edit" : "Only creator can edit"}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => void op("whiteboard.delete", { id: w.id })}>
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
        {!state.whiteboards.length && <p className="py-4 text-center text-sm text-muted-foreground">No whiteboards yet</p>}
      </ul>
    </div>
  );
}

function ChatPanel() {
  const { state } = useMeeting();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [state.chat.length]);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Chat with your team. Messages aren&apos;t included in meeting reports. Chat is not anonymous.</p>
      <CommentThread targetType="chat" targetId={state.meeting.id} comments={state.chat} placeholder="Post message…" />
      <div ref={endRef} />
    </div>
  );
}
