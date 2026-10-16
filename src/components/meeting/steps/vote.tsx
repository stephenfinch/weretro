"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMeeting } from "../use-meeting";
import { Board, Column } from "../board-column";
import { IdeaCard } from "../idea-card";
import { GroupStackReadonly } from "./group";
import { discussionItems, sortItems, stepOptions, type DiscussionItem } from "../helpers";
import type { VoteOptions } from "@/lib/types";

export function VoteControl({ item, disabled }: { item: DiscussionItem; disabled?: boolean }) {
  const { state, op } = useMeeting();
  const remaining = state.voting.remaining;
  const canAdd = !disabled && state.me.canContribute && (remaining === null || remaining > 0);
  return (
    <div className="flex items-center gap-1">
      {item.myVotes > 0 && (
        <button
          type="button"
          disabled={disabled || !state.me.canContribute}
          onClick={() => void op("vote.cast", { targetId: item.id, delta: -1 })}
          className="flex size-7 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          aria-label="Vote down"
        >
          <Minus className="size-3.5" />
        </button>
      )}
      {item.myVotes > 0 && (
        <span className="flex gap-0.5">
          {Array.from({ length: Math.min(item.myVotes, 8) }).map((_, i) => (
            <span key={i} className="size-2.5 rounded-full bg-primary" />
          ))}
          {item.myVotes > 8 && <span className="text-xs">+{item.myVotes - 8}</span>}
        </span>
      )}
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => void op("vote.cast", { targetId: item.id, delta: 1 })}
        className={cn("flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition hover:scale-105 disabled:opacity-30 disabled:hover:scale-100")}
        aria-label="Vote up"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function VoteBadge({ votes }: { votes: number | null }) {
  if (!votes) return null;
  return <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow">{votes}</span>;
}

export function VoteStep() {
  const { state } = useMeeting();
  const opts = stepOptions<VoteOptions>(state, "vote");
  const items = sortItems(discussionItems(state), state, opts.sort ?? "original");
  const revealed = opts.reveal === "immediately";
  return (
    <Board count={state.meeting.topics.length}>
      {state.meeting.topics.map((t) => {
        const list = items.filter((i) => i.topicId === t.id);
        return (
          <Column key={t.id} topic={t} count={list.length}>
            {list.map((item) => {
              const footer = (
                <div className="flex items-center justify-end gap-2">
                  {revealed && <VoteBadge votes={item.votes} />}
                  <VoteControl item={item} />
                </div>
              );
              return item.kind === "group" && item.group ? (
                <GroupStackReadonly key={item.id} group={item.group} ideas={item.ideas} footer={footer} />
              ) : (
                <IdeaCard key={item.id} idea={item.ideas[0]} footer={footer} />
              );
            })}
          </Column>
        );
      })}
    </Board>
  );
}
