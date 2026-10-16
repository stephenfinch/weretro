"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHECK_QUESTIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { useMeeting } from "./use-meeting";

export function CheckQuestion({ kind }: { kind: "in" | "out" }) {
  const { state, op } = useMeeting();
  const c = state.checks.find((x) => x.kind === kind);
  if (!c) return null;
  const q = CHECK_QUESTIONS.find((x) => x.key === c.question);
  if (!q) return null;
  const max = Math.max(1, ...(c.distribution ?? [0]));
  const canAnswer = !!state.me.participantId && state.me.role !== "observer";
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 rounded-3xl border bg-card p-6 shadow-sm">
      <div className="text-center">
        <p className="text-xs font-semibold tracking-wide text-primary uppercase">Check-{kind}: {q.title}</p>
        <h3 className="mt-1 text-xl font-semibold">{q.question}</h3>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {q.options.map((o, i) => {
          const v = i + 1;
          const mine = c.myValue === v;
          const count = c.distribution?.[i] ?? 0;
          return (
            <button
              key={v}
              type="button"
              disabled={!canAnswer}
              onClick={() => void op("check.respond", { kind, value: v })}
              className={cn("relative flex flex-col items-center gap-1 overflow-hidden rounded-2xl border p-3 text-center transition", mine ? "border-primary bg-primary/10" : "hover:bg-muted")}
              title={o.description}
            >
              {c.distribution && <span className="absolute inset-x-0 bottom-0 bg-primary/15" style={{ height: `${(count / max) * 100}%` }} />}
              <span className="relative text-3xl">{o.emoji}</span>
              <span className="relative text-xs font-medium">{o.label}</span>
              {c.distribution && <span className="relative text-sm font-bold">{count}</span>}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{c.responded} responded</span>
        {c.myValue && !c.revealed && <span>Thanks! Waiting for the facilitator to reveal the results…</span>}
        {state.me.isFacilitator && (
          <Button size="sm" variant="outline" onClick={() => void op("check.reveal", { kind, revealed: !c.revealed })}>
            {c.revealed ? <EyeOff /> : <Eye />} {c.revealed ? "Hide results" : "Reveal results"}
          </Button>
        )}
      </div>
    </div>
  );
}
