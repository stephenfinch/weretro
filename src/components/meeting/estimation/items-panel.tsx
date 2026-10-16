"use client";

import { cn } from "@/lib/utils";
import { useMeeting } from "../use-meeting";
import { useCurrentItem } from "./estimate";
import { EstimationItemList } from "./prepare";

export function EstimationItemsPanel() {
  const { state, op } = useMeeting();
  const { items, current } = useCurrentItem();
  const key = state.meeting.steps[state.meeting.stepIndex]?.key;
  if (key !== "estimate") return <EstimationItemList editable={state.me.isFacilitator || state.me.canContribute} />;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={it.id}>
          <button
            type="button"
            disabled={!state.me.isFacilitator}
            onClick={() => void op("present.set", { active: true, targetId: it.id })}
            className={cn("flex w-full items-center gap-2 rounded-xl border p-2.5 text-left text-sm transition", current?.id === it.id ? "border-primary bg-primary/5" : "hover:bg-muted")}
          >
            <span className="w-5 text-xs text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{it.title}</span>
            {it.finalEstimate ? (
              <span className="rounded-md bg-primary/10 px-1.5 text-xs font-semibold text-primary">{it.finalEstimate}</span>
            ) : (
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">{it.phase}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
