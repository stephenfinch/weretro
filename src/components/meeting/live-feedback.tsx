"use client";

import { useEffect, useState } from "react";
import { Hand, Rewind, FastForward, ThumbsUp, ThumbsDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { REACTION_EMOJIS } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMeeting } from "./use-meeting";

export function LiveFeedbackBar() {
  const { state, op } = useMeeting();
  const lf = state.meeting.options.liveFeedback ?? {};
  if (lf.enabled === false || !state.me.participantId) return null;
  const mine = (kind: string) => state.liveEvents.some((e) => e.kind === kind && e.active && state.participants.find((p) => p.id === e.participantId)?.isMe);
  const count = (kind: string) => state.liveEvents.filter((e) => e.kind === kind && e.active).length;
  const btn = (kind: string, Icon: typeof Hand, label: string) => (
    <button
      type="button"
      onClick={() => void op("live.send", { kind })}
      title={label}
      className={cn("relative flex size-9 items-center justify-center rounded-full transition hover:bg-muted", mine(kind) && "bg-primary text-primary-foreground hover:bg-primary")}
    >
      <Icon className="size-4.5" />
      {count(kind) > 0 && <span className="absolute -top-1 -right-1 min-w-4 rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">{count(kind)}</span>}
    </button>
  );
  return (
    <div className="no-print pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/95 p-1.5 shadow-lg backdrop-blur">
      {lf.reactions !== false &&
        REACTION_EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => void op("live.send", { kind: "reaction", emoji: e })} className="flex size-9 items-center justify-center rounded-full text-lg transition hover:scale-125 hover:bg-muted">
            {e}
          </button>
        ))}
      {lf.slowerFaster !== false && (
        <span className="ml-1 flex border-l pl-1">
          {btn("slower", Rewind, "Go slower")}
          {btn("faster", FastForward, "Go faster")}
        </span>
      )}
      {lf.agreeDisagree !== false && (
        <span className="ml-1 flex border-l pl-1">
          {btn("agree", ThumbsUp, "Agree")}
          {btn("disagree", ThumbsDown, "Disagree")}
        </span>
      )}
      {lf.raisedHand !== false && <span className="ml-1 flex border-l pl-1">{btn("hand", Hand, "Raise hand")}</span>}
      {state.me.isFacilitator && state.liveEvents.some((e) => e.active) && (
        <Popover>
          <PopoverTrigger className="ml-1 flex size-9 items-center justify-center rounded-full border-l text-xs text-muted-foreground hover:bg-muted" title="Live feedback">
            <X className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-56 space-y-2 text-sm">
            {["hand", "agree", "disagree", "slower", "faster"].map((k) => {
              const people = state.liveEvents.filter((e) => e.kind === k && e.active).map((e) => state.participants.find((p) => p.id === e.participantId)?.name ?? "Someone");
              if (!people.length) return null;
              return (
                <div key={k}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">{k === "hand" ? "Raised hands" : k}</p>
                  <p>{people.join(", ")}</p>
                </div>
              );
            })}
            <button type="button" className="text-xs font-medium text-primary" onClick={() => void op("live.clear")}>
              Clear all
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/** Emoji that float up the screen when anyone reacts live. */
export function FloatingReactions() {
  const { state } = useMeeting();
  const now = useNow(500);
  // Each reaction floats for a few seconds after it arrives; its lane comes from its id so it stays put across renders.
  const shown = state.liveEvents
    .filter((e) => e.kind === "reaction" && e.emoji && now - new Date(e.createdAt).getTime() < 4000)
    .map((e) => ({ id: e.id, emoji: e.emoji!, left: 10 + (hash(e.id) % 80) }));
  const hands = state.liveEvents.filter((e) => e.kind === "hand" && e.active);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {shown.map((s) => (
        <span key={s.id} className="animate-float-up absolute bottom-16 text-4xl" style={{ left: `${s.left}%` }}>
          {s.emoji}
        </span>
      ))}
      {hands.length > 0 && (
        <div className="absolute top-3 right-3 flex flex-col gap-1">
          {hands.map((h) => (
            <span key={h.id} className="animate-pop-in flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-sm font-medium text-amber-950 shadow">
              <Hand className="size-4" /> {state.participants.find((p) => p.id === h.participantId)?.name ?? "Someone"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
