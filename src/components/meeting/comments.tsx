"use client";

import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { CornerDownRight, MoreHorizontal, ParkingSquare, Pencil, Trash2, ListChecks, EyeOff } from "lucide-react";
import type { CommentDTO } from "@/lib/meeting-types";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMeeting } from "./use-meeting";
import { Reactions } from "./reactions";
import { MentionInput } from "./mention-input";
import { Attachments } from "./attachments";

export function CommentThread({ targetType, targetId, comments, compact, placeholder }: { targetType: string; targetId: string; comments?: CommentDTO[]; compact?: boolean; placeholder?: string }) {
  const { state, op, typing } = useMeeting();
  const list = (comments ?? state.comments).filter((c) => c.targetId === targetId);
  const roots = list.filter((c) => !c.parentId);
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const canComment = !!state.me.participantId && state.me.role !== "observer" && (targetType === "chat" || state.meeting.options.comments !== false || ["action", "update", "estimationItem"].includes(targetType));
  const submit = async (parentId?: string, value?: string) => {
    const t = (value ?? text).trim();
    if (!t) return;
    if (!value) setText("");
    await op("comment.add", { targetType, targetId, text: t, parentId, anonymous: anon });
  };
  return (
    <div className="space-y-2">
      {roots.map((c) => (
        <CommentItem key={c.id} c={c} replies={list.filter((r) => r.parentId === c.id)} onReply={(v) => submit(c.id, v)} compact={compact} />
      ))}
      {canComment && (
        <div className="flex items-start gap-2 rounded-xl border bg-background/60 px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/30">
          <MentionInput value={text} onChange={setText} onSubmit={() => void submit()} onKeyStroke={typing} members={state.members} placeholder={placeholder ?? "Add comment…"} className="py-1" />
          {state.meeting.options.allowAnonymousContributions && targetType !== "chat" && (
            <button type="button" onClick={() => setAnon(!anon)} title={anon ? "Anonymous (click to toggle)" : "Non-anonymous (click to toggle)"} className={cn("mt-1 rounded p-0.5", anon ? "text-primary" : "text-muted-foreground")}>
              <EyeOff className="size-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({ c, replies, onReply, compact }: { c: CommentDTO; replies: CommentDTO[]; onReply: (t: string) => void; compact?: boolean }) {
  const { state, op } = useMeeting();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.text);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const canReact = state.meeting.options.commentReactions !== false && !!state.me.participantId && state.me.role !== "observer";
  return (
    <div className="group/card">
      <div className="flex items-start gap-2">
        <UserAvatar name={c.authorName} color={c.authorColor} src={c.authorAvatarUrl} size={compact ? 20 : 24} />
        <div className="min-w-0 flex-1">
          <div className={cn("rounded-xl bg-muted/70 px-3 py-1.5", c.parked && "ring-1 ring-amber-400")}>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-medium">{c.authorName}</span>
              <span className="text-muted-foreground">{formatDistanceToNowStrict(new Date(c.createdAt), { addSuffix: true })}</span>
              {c.parked && <span className="text-amber-600">Parked</span>}
              <DropdownMenu>
                <DropdownMenuTrigger className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 group-hover/card:opacity-100 hover:bg-background" aria-label="More options">
                  <MoreHorizontal className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setReplying(true)}>
                    <CornerDownRight /> Reply
                  </DropdownMenuItem>
                  {c.mine && (
                    <DropdownMenuItem onSelect={() => setEditing(true)}>
                      <Pencil /> Edit comment
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => void op("action.add", { kind: "action", title: c.text, sourceType: "comment", sourceId: c.id })}>
                    <ListChecks /> Copy to action
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void op("comment.park", { id: c.id, parked: !c.parked })}>
                    <ParkingSquare /> {c.parked ? "Unpark comment" : "Park comment"}
                  </DropdownMenuItem>
                  {(c.mine || state.me.isFacilitator) && (
                    <DropdownMenuItem variant="destructive" onSelect={() => void op("comment.delete", { id: c.id })}>
                      <Trash2 /> Remove comment
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {editing ? (
              <MentionInput
                autoFocus
                value={draft}
                onChange={setDraft}
                members={state.members}
                onSubmit={() => {
                  void op("comment.update", { id: c.id, text: draft });
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <p className="text-sm break-words whitespace-pre-wrap">{c.text}</p>
            )}
            <Attachments items={c.attachments} />
          </div>
          {(c.reactions.length > 0 || canReact) && (
            <div className="mt-0.5 pl-1">
              <Reactions reactions={c.reactions} canReact={canReact} compact onToggle={(emoji) => void op("reaction.toggle", { targetId: c.id, emoji })} />
            </div>
          )}
          {replies.length > 0 && (
            <div className="mt-1 space-y-1.5 border-l pl-3">
              {replies.map((r) => (
                <CommentItem key={r.id} c={r} replies={[]} onReply={onReply} compact />
              ))}
            </div>
          )}
          {replying && (
            <div className="mt-1 rounded-lg border bg-background px-2 py-1">
              <MentionInput
                autoFocus
                value={reply}
                onChange={setReply}
                members={state.members}
                placeholder="Reply…"
                onSubmit={() => {
                  onReply(reply);
                  setReply("");
                  setReplying(false);
                }}
                onCancel={() => setReplying(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
