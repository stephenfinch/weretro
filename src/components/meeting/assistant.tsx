"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Check, Loader2, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMeeting } from "./use-meeting";
import { currentStepKey } from "./helpers";

type Line = { role: "user" | "assistant" | "activity"; text: string };

const PROMPTS: Record<string, string[]> = {
  "retrospective:brainstorm": ["Help me think of things to write", "What's still open from last time?", "How many people have added cards so far?"],
  "retrospective:group": ["Which cards look like they belong together?", "Summarize the key themes so far", "Which cards stand on their own?"],
  "retrospective:vote": ["Summarize the key themes so far", "What should I weigh up before voting?", "What's still open from last time?"],
  "retrospective:discuss": ["Draft actions from top-voted ideas", "Turn the top theme into an action", "Which actions still need an owner or a date?"],
  "retrospective:review": ["Draft actions from top-voted ideas", "Which actions still need an owner or a date?", "What should we park for next time?"],
  "retrospective:share": ["Summarize this retro", "Which actions have no owner or due date?", "What should we park for next time?"],
  "retrospective:default": ["What's still open from last time?", "What did we agree to last time?", "How did our last retro go?"],
  "healthCheck:default": ["Summarize results and concerns", "Suggest actions for our lowest area", "Compare to our last health check"],
  "estimation:default": ["Summarize our estimates so far", "Which items had the widest spread?", "Create actions from what we discussed"],
  "standup:default": ["Summarize today's updates so far", "Who hasn't checked in yet?", "Create actions for our blockers"],
};

export function AssistantPanel() {
  const { state } = useMeeting();
  const [lines, setLines] = useState<Line[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const id = state.meeting.id;
  useEffect(() => {
    void fetch(`/api/ai/assistant/${id}`)
      .then((r) => r.json())
      .then((j) => setLines(j.messages ?? []));
  }, [id]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [lines.length, busy]);
  const key = currentStepKey(state);
  const prompts = PROMPTS[`${state.meeting.type}:${key}`] ?? PROMPTS[`${state.meeting.type}:default`] ?? [];
  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setText("");
    setLines((l) => [...l, { role: "user", text: msg }]);
    setBusy(true);
    const res = await fetch(`/api/ai/assistant/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: msg }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error(json.error ?? "Something went wrong. Please try again.");
    setLines(json.messages);
  };
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Bot className="size-4" /> Your private AI assistant. It only sees what you can see.
        {lines.length > 0 && (
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
            onClick={async () => {
              if (!confirm("Start a new conversation? This removes the current one.")) return;
              await fetch(`/api/ai/assistant/${id}`, { method: "DELETE" });
              setLines([]);
            }}
          >
            <RotateCcw className="size-3" /> New
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {lines.map((l, i) =>
          l.role === "activity" ? (
            <p key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3 text-emerald-500" /> {l.text}
            </p>
          ) : (
            <div key={i} className={cn("rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap", l.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-4 bg-muted")}>
              {l.text}
            </div>
          ),
        )}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" /> Thinking…
          </p>
        )}
        {!lines.length && !busy && (
          <div className="space-y-2 pt-2">
            {prompts.map((p) => (
              <button key={p} type="button" onClick={() => void send(p)} className="block w-full rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted">
                {p}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(text);
        }}
        className="mt-3 flex items-end gap-2 rounded-2xl border px-3 py-2"
      >
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          placeholder="Chat with the assistant…"
          className="max-h-32 min-w-0 flex-1 resize-none bg-transparent text-sm outline-none"
        />
        <Button size="icon-sm" type="submit" disabled={busy || !text.trim()} aria-label="Send">
          <Send />
        </Button>
      </form>
    </div>
  );
}
