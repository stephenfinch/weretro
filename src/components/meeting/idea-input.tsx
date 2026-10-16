"use client";

import { useRef, useState } from "react";
import { EyeOff, Plus } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMeeting } from "./use-meeting";
import { EmojiPicker } from "./emoji-picker";
import { AttachMenu, Attachments } from "./attachments";
import { KudosDialog, PollDialog } from "./idea-card";
import { ideaBg } from "./helpers";

export function IdeaInput({ topicId, color, onWhiteboard }: { topicId: string; color: string; onWhiteboard?: (id: string) => void }) {
  const { state, op, typing } = useMeeting();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [anon, setAnon] = useState(false);
  const [poll, setPoll] = useState(false);
  const [kudos, setKudos] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  if (!state.me.canContribute) return null;
  const submit = async () => {
    if ((!text.trim() && !attachments.length) || busy) return;
    setBusy(true);
    const r = await op("idea.add", { topicId, text: text.trim(), attachments, anonymous: anon });
    setBusy(false);
    if (r.ok) {
      setText("");
      setAttachments([]);
      if (ref.current) ref.current.style.height = "auto";
      ref.current?.focus();
    }
  };
  return (
    <div className="rounded-xl border-2 border-dashed px-2.5 py-2 transition focus-within:border-solid" style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, background: ideaBg(color, 0.08) }}>
      <div className="flex items-start gap-1.5">
        <Plus className="mt-1.5 size-4 shrink-0" style={{ color }} />
        <textarea
          ref={ref}
          rows={1}
          value={text}
          disabled={busy}
          placeholder="Add an idea…"
          onChange={(e) => {
            setText(e.target.value);
            typing();
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="min-w-0 flex-1 resize-none bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center">
          <EmojiPicker onPick={(e) => setText((t) => t + e)} align="end" />
          <AttachMenu
            onAttach={(a) => setAttachments((x) => [...x, a])}
            onPoll={() => setPoll(true)}
            onKudos={state.meeting.options.kudos !== false ? () => setKudos(true) : undefined}
            onWhiteboard={
              onWhiteboard
                ? async () => {
                    const r = await op("whiteboard.create", { title: text.trim() || "Idea whiteboard", attachedType: "meeting" });
                    const id = (r.result as { id?: string } | undefined)?.id;
                    if (id) onWhiteboard(id);
                  }
                : undefined
            }
          />
          {state.meeting.options.allowAnonymousContributions && (
            <button type="button" onClick={() => setAnon(!anon)} title={anon ? "Anonymous (click to toggle)" : "Non-anonymous (click to toggle)"} className={cn("inline-flex size-7 items-center justify-center rounded-full", anon ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted")}>
              <EyeOff className="size-4" />
            </button>
          )}
        </div>
      </div>
      <Attachments items={attachments} onRemove={(i) => setAttachments((x) => x.filter((_, j) => j !== i))} />
      <PollDialog open={poll} onOpenChange={setPoll} topicId={topicId} />
      <KudosDialog open={kudos} onOpenChange={setKudos} />
    </div>
  );
}
