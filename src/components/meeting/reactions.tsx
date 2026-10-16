"use client";

import type { ReactionDTO } from "@/lib/meeting-types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmojiPicker } from "./emoji-picker";
import { REACTION_EMOJIS } from "@/lib/constants";

export function Reactions({ reactions, onToggle, canReact, compact }: { reactions: ReactionDTO[]; onToggle: (emoji: string) => void; canReact: boolean; compact?: boolean }) {
  if (!reactions.length && !canReact) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map((r) => (
        <Tooltip key={r.emoji}>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={!canReact}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(r.emoji);
              }}
              className={cn(
                "inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs transition",
                r.mine ? "border-primary/60 bg-primary/10" : "border-transparent bg-black/5 dark:bg-white/10",
              )}
            >
              <span className="text-sm leading-none">{r.emoji}</span>
              {r.count > 1 && <span className="font-medium">{r.count}</span>}
            </button>
          </TooltipTrigger>
          {r.names.length > 0 && <TooltipContent>{r.names.join(", ")}</TooltipContent>}
        </Tooltip>
      ))}
      {canReact && (
        <span className="opacity-0 transition group-hover/card:opacity-100 focus-within:opacity-100 has-[[data-state=open]]:opacity-100">
          <QuickReact onPick={onToggle} compact={compact} />
        </span>
      )}
    </div>
  );
}

function QuickReact({ onPick, compact }: { onPick: (e: string) => void; compact?: boolean }) {
  return (
    <span className="inline-flex items-center">
      {!compact &&
        REACTION_EMOJIS.slice(0, 3).map((e) => (
          <button key={e} type="button" onClick={(ev) => { ev.stopPropagation(); onPick(e); }} className="flex size-6 items-center justify-center rounded-full text-sm hover:bg-black/5 dark:hover:bg-white/10">
            {e}
          </button>
        ))}
      <EmojiPicker onPick={onPick} className="size-6" />
    </span>
  );
}
