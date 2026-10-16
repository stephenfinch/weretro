"use client";

import { useState } from "react";
import { Copy, ListChecks, MessageSquare, MoreHorizontal, ParkingSquare, Pencil, Trash2, Ungroup, EyeOff, Palette, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import type { IdeaDTO, PollDTO } from "@/lib/meeting-types";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { PALETTE, KUDOS_TYPES } from "@/lib/constants";
import { useMeeting } from "./use-meeting";
import { Reactions } from "./reactions";
import { Attachments } from "./attachments";
import { CommentThread } from "./comments";
import { ideaBg, participantColor, participantName, stepOptions, topicColor } from "./helpers";
import type { BrainstormOptions } from "@/lib/types";
import { TopicIcon } from "@/components/meeting-setup/settings-editor";

export function useIdeaColor() {
  const { state } = useMeeting();
  const mode = stepOptions<BrainstormOptions>(state, "brainstorm").colorIdea ?? "topic";
  return (idea: IdeaDTO) => {
    if (mode === "manual" && idea.color) return idea.color;
    if (mode === "participant" && idea.authorId) return participantColor(state, idea.authorId);
    return topicColor(state, idea.topicId);
  };
}

export function IdeaCard({
  idea,
  className,
  showComments,
  footer,
  dragHandle,
  inGroup,
  large,
}: {
  idea: IdeaDTO;
  className?: string;
  showComments?: boolean;
  footer?: React.ReactNode;
  dragHandle?: React.ReactNode;
  inGroup?: boolean;
  large?: boolean;
}) {
  const { state, op } = useMeeting();
  const colorOf = useIdeaColor();
  const color = colorOf(idea);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(idea.text);
  const [commentsOpen, setCommentsOpen] = useState(!!showComments);
  const canEdit = (idea.mine || state.me.isFacilitator) && state.meeting.status === "open";
  const canReact = state.meeting.options.reactions !== false && !!state.me.participantId && state.me.role !== "observer";
  const brainstorm = stepOptions<BrainstormOptions>(state, "brainstorm");
  const save = () => {
    if (draft.trim() && draft.trim() !== idea.text) void op("idea.update", { id: idea.id, text: draft.trim() });
    setEditing(false);
  };
  return (
    <div
      className={cn("group/card relative rounded-xl border border-black/5 px-3 py-2.5 shadow-xs transition dark:border-white/5", idea.parked && "ring-1 ring-amber-400/70", className)}
      style={{ background: ideaBg(color, 0.18), borderLeft: inGroup ? undefined : `3px solid ${color}` }}
    >
      <div className="flex items-start gap-2">
        {dragHandle}
        <div className="min-w-0 flex-1">
          {editing ? (
            <Textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  save();
                }
                if (e.key === "Escape") setEditing(false);
              }}
              className="min-h-0 bg-background/70 text-sm"
            />
          ) : (
            !idea.poll && (
              <p
                className={cn("break-words whitespace-pre-wrap", large ? "text-xl leading-snug font-medium" : "text-sm leading-snug")}
                onDoubleClick={() => {
                  if (!canEdit) return;
                  setDraft(idea.text);
                  setEditing(true);
                }}
              >
                {idea.text}
              </p>
            )
          )}
          <Attachments items={idea.attachments} />
          {idea.poll && <PollWidget poll={idea.poll} large={large} />}
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {idea.authorId && brainstorm.showAvatar === "shown" && !idea.anonymous && (
            <UserAvatar name={participantName(state, idea.authorId)} color={participantColor(state, idea.authorId)} size={20} />
          )}
          {idea.anonymous && <EyeOff className="size-3.5 text-muted-foreground" aria-label="Anonymous" />}
          <IdeaMenu idea={idea} onEdit={() => { setDraft(idea.text); setEditing(true); }} canEdit={canEdit} />
        </div>
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          idea.reactions.length || idea.commentCount || footer || commentsOpen ? "mt-1.5" : "h-0 overflow-hidden group-hover/card:mt-1.5 group-hover/card:h-auto group-hover/card:overflow-visible has-[[data-state=open]]:mt-1.5 has-[[data-state=open]]:h-auto",
        )}
      >
        <Reactions reactions={idea.reactions} canReact={canReact} onToggle={(emoji) => void op("reaction.toggle", { targetId: idea.id, emoji })} />
        {state.meeting.options.comments !== false && (idea.commentCount > 0 || canReact) && (
          <button
            type="button"
            onClick={() => setCommentsOpen(!commentsOpen)}
            className={cn("inline-flex h-6 items-center gap-1 rounded-full px-1.5 text-xs text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10", idea.commentCount === 0 && "opacity-0 group-hover/card:opacity-100")}
          >
            <MessageSquare className="size-3.5" /> {idea.commentCount || ""}
          </button>
        )}
        <div className="ml-auto">{footer}</div>
      </div>
      {commentsOpen && (
        <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/10">
          <CommentThread targetType="idea" targetId={idea.id} compact />
        </div>
      )}
    </div>
  );
}

function IdeaMenu({ idea, onEdit, canEdit }: { idea: IdeaDTO; onEdit: () => void; canEdit: boolean }) {
  const { state, op } = useMeeting();
  const manual = stepOptions<BrainstormOptions>(state, "brainstorm").colorIdea === "manual";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md p-0.5 text-muted-foreground opacity-0 transition group-hover/card:opacity-100 hover:bg-black/5 data-[state=open]:opacity-100 dark:hover:bg-white/10" aria-label="More options">
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {canEdit && !idea.poll && (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> Edit idea
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard.writeText(idea.text);
            toast.success("Copied to clipboard");
          }}
        >
          <Copy /> Copy idea to clipboard
        </DropdownMenuItem>
        {state.me.role !== "observer" && (
          <DropdownMenuItem onSelect={() => void op("action.add", { kind: "action", title: idea.text, sourceType: "idea", sourceId: idea.id })}>
            <ListChecks /> Copy idea to action
          </DropdownMenuItem>
        )}
        {canEdit && manual && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette /> Color
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="grid grid-cols-5 gap-1 p-2">
              {PALETTE.slice(0, 15).map((c) => (
                <button key={c} type="button" onClick={() => void op("idea.update", { id: idea.id, color: c })} className="size-6 rounded-full" style={{ background: c }} />
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {canEdit && state.meeting.topics.length > 1 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft /> Move to topic
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {state.meeting.topics.map((t) => (
                <DropdownMenuItem key={t.id} disabled={t.id === idea.topicId} onSelect={() => void op("idea.update", { id: idea.id, topicId: t.id })}>
                  <TopicIcon name={t.icon} color={t.color} className="size-4" /> {t.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {idea.groupId && (
          <DropdownMenuItem onSelect={() => void op("idea.move", { id: idea.id, groupId: null })}>
            <Ungroup /> Ungroup idea
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => void op("idea.park", { id: idea.id, parked: !idea.parked })}>
          <ParkingSquare /> {idea.parked ? "Unpark this idea" : "Park this idea"}
        </DropdownMenuItem>
        {canEdit && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void op("idea.delete", { id: idea.id })}>
              <Trash2 /> Delete idea
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PollWidget({ poll, large }: { poll: PollDTO; large?: boolean }) {
  const { state, op } = useMeeting();
  const [editing, setEditing] = useState(false);
  const total = state.participants.filter((p) => ["facilitator", "participant", "guest"].includes(p.role)).length;
  const max = Math.max(1, ...poll.options.map((o) => o.count ?? 0));
  const canRespond = state.me.canContribute;
  return (
    <div className="space-y-1.5">
      <p className={cn("font-medium", large ? "text-xl" : "text-sm")}>{poll.question}</p>
      {poll.options.map((o) => {
        const mine = poll.myOptionId === o.id;
        return (
          <button
            key={o.id}
            type="button"
            disabled={!canRespond}
            onClick={() => void op("poll.respond", { id: poll.id, optionId: mine ? null : o.id })}
            className={cn("relative flex w-full items-center justify-between overflow-hidden rounded-full border px-3 py-1 text-left text-sm transition", mine ? "border-primary" : "border-black/10 hover:border-primary/50 dark:border-white/15")}
          >
            {o.count !== null && <span className="absolute inset-y-0 left-0 bg-primary/15" style={{ width: `${((o.count ?? 0) / max) * 100}%` }} />}
            <span className="relative flex items-center gap-2">
              <span className={cn("size-3 rounded-full border-2", mine ? "border-primary bg-primary" : "border-muted-foreground/50")} />
              {o.label}
            </span>
            {o.count !== null && <span className="relative font-medium">{o.count}</span>}
          </button>
        );
      })}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {poll.responded}/{total} participants responded
        </span>
        {poll.canEdit && (
          <span className="flex gap-2">
            <button type="button" className="hover:text-foreground" onClick={() => void op("poll.update", { id: poll.id, revealed: !poll.revealed })}>
              {poll.revealed ? "Hide results" : "Reveal results"}
            </button>
            <button type="button" className="hover:text-foreground" onClick={() => setEditing(true)}>
              Edit
            </button>
          </span>
        )}
      </div>
      <PollDialog open={editing} onOpenChange={setEditing} poll={poll} />
    </div>
  );
}

export function PollDialog({ open, onOpenChange, poll, topicId }: { open: boolean; onOpenChange: (o: boolean) => void; poll?: PollDTO; topicId?: string }) {
  const { op } = useMeeting();
  const [question, setQuestion] = useState(poll?.question ?? "");
  const [options, setOptions] = useState<string[]>(poll ? poll.options.map((o) => o.label) : ["", ""]);
  const [revealed, setRevealed] = useState(poll?.revealed ?? true);
  const submit = async () => {
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) return void toast.error("Add a question and at least two options");
    if (poll) await op("poll.update", { id: poll.id, question, options: opts.map((label, i) => ({ id: poll.options[i]?.id, label })), revealed });
    else await op("poll.create", { topicId, question, options: opts, revealed });
    onOpenChange(false);
    if (!poll) {
      setQuestion("");
      setOptions(["", ""]);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{poll ? "Edit poll" : "Add a poll"}</DialogTitle>
        </DialogHeader>
        <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Add question…" autoFocus />
        <div className="space-y-2">
          {options.map((o, i) => (
            <Input key={i} value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
          ))}
          <Button variant="ghost" size="sm" onClick={() => setOptions([...options, ""])}>
            Add option…
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!revealed} onChange={(e) => setRevealed(!e.target.checked)} /> Hide results until revealed
        </label>
        <DialogFooter>
          {poll && (
            <Button variant="ghost" className="mr-auto text-destructive" onClick={() => { void op("poll.delete", { id: poll.id }); onOpenChange(false); }}>
              Delete poll
            </Button>
          )}
          <Button onClick={submit}>{poll ? "Save" : "Add poll"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KudosDialog({ open, onOpenChange, toUserId }: { open: boolean; onOpenChange: (o: boolean) => void; toUserId?: string }) {
  const { state, op } = useMeeting();
  const [to, setTo] = useState<string>(toUserId ?? "");
  const [type, setType] = useState(KUDOS_TYPES[0].key);
  const [message, setMessage] = useState("");
  const people = state.members.filter((m) => m.userId !== state.me.userId);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Give kudos</DialogTitle>
        </DialogHeader>
        <Select value={to} onValueChange={setTo}>
          <SelectTrigger className="w-full"><SelectValue placeholder="Choose a teammate…" /></SelectTrigger>
          <SelectContent>
            {people.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-3 gap-2">
          {KUDOS_TYPES.map((k) => (
            <button key={k.key} type="button" onClick={() => setType(k.key)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-medium transition", type === k.key ? "border-primary bg-primary/10" : "hover:bg-muted")}>
              <span className="text-2xl">{k.emoji}</span>
              {k.label}
            </button>
          ))}
        </div>
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional message…" rows={2} />
        <DialogFooter>
          <Button
            disabled={!to}
            onClick={async () => {
              const r = await op("kudos.give", { toUserId: to, kudosType: type, message });
              if (r.ok) {
                toast.success("Kudos sent 🎉");
                onOpenChange(false);
                setMessage("");
              }
            }}
          >
            Give kudos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
