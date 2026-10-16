"use client";

import { CheckCircle2, Circle, Presentation, Sparkles, Ban, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/user-avatar";
import { STEP_INSTRUCTIONS } from "@/lib/constants";
import type { StepKey } from "@/lib/types";
import { useMeeting } from "./use-meeting";
import { contributors, currentStepKey } from "./helpers";
import { StepOptionChips } from "@/components/meeting-setup/settings-editor";
import { TimerControl } from "./timer";

const FINISHABLE: StepKey[] = ["brainstorm", "group", "vote", "healthSurvey", "standup", "estimate", "prepare"];
const PRESENTABLE: StepKey[] = ["discuss", "healthDiscuss", "estimate", "standup", "review", "openActions"];

export function StepToolbar({ onCustomize }: { onCustomize: () => void }) {
  const { state, op } = useMeeting();
  const key = currentStepKey(state);
  const step = state.meeting.steps[state.meeting.stepIndex];
  const fac = state.me.isFacilitator;
  const me = state.participants.find((p) => p.isMe);
  const finished = !!me?.finishedSteps.includes(key);
  const people = contributors(state);
  const doneCount = people.filter((p) => p.finishedSteps.includes(key)).length;
  const presenting = state.meeting.presenting?.active;
  const [suggesting, setSuggesting] = useState(false);

  const suggest = async (kind: "groups" | "actions") => {
    setSuggesting(true);
    const res = await fetch(`/api/ai/meetings/${state.meeting.id}/suggest-${kind}`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setSuggesting(false);
    if (!res.ok) toast.error(json.error ?? "AI suggestions failed");
    else toast.success(json.message ?? "Suggestions added");
  };

  if (state.meeting.status === "closed" && key === "share") return null;
  return (
    <div className="no-print flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b bg-background/60 px-4 py-1.5 backdrop-blur">
      <p className="text-sm text-muted-foreground italic">{STEP_INSTRUCTIONS[key]}</p>
      {FINISHABLE.includes(key) && state.me.canContribute && key !== "standup" && (
        <Button size="sm" variant={finished ? "secondary" : "ghost"} className="rounded-full" onClick={() => void op("step.finish", { step: key, finished: !finished })} title="Let everyone know you are ready to move on">
          {finished ? <CheckCircle2 className="text-emerald-500" /> : <Circle />} {finished ? "Finished" : "I'm finished"}
        </Button>
      )}
      {key === "vote" && state.me.canContribute && (
        <>
          <span className="text-sm font-medium">{state.voting.remaining === null ? "Unlimited votes" : state.voting.remaining === 0 ? "No votes remaining" : `${state.voting.remaining} ${state.voting.remaining === 1 ? "vote" : "votes"} remaining`}</span>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void op("vote.abstain", { abstained: !me?.abstained })} title="Let everyone know you have abstained">
            <Ban /> {me?.abstained ? "Abstained" : "Abstain"}
          </Button>
        </>
      )}
      {FINISHABLE.includes(key) && people.length > 0 && (
        <Popover>
          <PopoverTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <span className="block h-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / people.length) * 100}%` }} />
            </span>
            {doneCount === 0 ? "No participants finished" : doneCount === people.length ? "All participants finished" : `${doneCount}/${people.length} participants finished`}
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2">
            {people.map((p) => (
              <div key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                <UserAvatar name={p.name} color={p.color} src={p.avatarUrl} size={20} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {p.finishedSteps.includes(key) ? <CheckCircle2 className="size-4 text-emerald-500" /> : p.typing ? <span className="text-xs text-muted-foreground">typing…</span> : null}
                {key === "vote" && p.abstained && <span className="text-xs text-muted-foreground">abstained</span>}
              </div>
            ))}
          </PopoverContent>
        </Popover>
      )}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        {fac && step && (
          <>
            <Button size="xs" variant="ghost" className="text-xs uppercase" onClick={onCustomize}>
              Customize…
            </Button>
            <StepOptionChips step={step} onChange={(options) => void op("meeting.update", { steps: [{ key: step.key, enabled: true, options }] })} />
          </>
        )}
        {fac && key === "vote" && (
          <Button size="xs" variant="ghost" onClick={() => void op("vote.reset")}>
            <RotateCcw /> Reset votes
          </Button>
        )}
        {fac && state.team.aiEnabled && key === "group" && (
          <Button size="xs" variant="outline" disabled={suggesting} onClick={() => void suggest("groups")}>
            {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest groups
          </Button>
        )}
        {fac && state.team.aiEnabled && (key === "discuss" || key === "review") && (
          <Button size="xs" variant="outline" disabled={suggesting} onClick={() => void suggest("actions")}>
            {suggesting ? <Loader2 className="animate-spin" /> : <Sparkles />} Suggest actions
          </Button>
        )}
        {fac && state.groups.some((g) => g.suggested) && key === "group" && (
          <>
            <Button size="xs" onClick={() => void op("group.acceptAll")}>Accept suggestions</Button>
            <Button size="xs" variant="ghost" onClick={() => void op("group.rejectAll")}>Reject suggestions</Button>
          </>
        )}
        {fac && PRESENTABLE.includes(key) && (
          <Button size="sm" variant={presenting ? "destructive" : "default"} className={cn("rounded-full", presenting && "border border-destructive")} onClick={() => void op("present.set", { active: !presenting })}>
            <Presentation /> {presenting ? "Stop presenting" : "Present"}
          </Button>
        )}
        <TimerControl />
      </div>
    </div>
  );
}
