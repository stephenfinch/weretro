"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessagesSquare, Presentation, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMeeting } from "../use-meeting";
import { Board, Column } from "../board-column";
import { IdeaCard, PollWidget } from "../idea-card";
import { GroupStackReadonly } from "./group";
import { VoteBadge } from "./vote";
import { discussList, ideaBg, topicColor, type DiscussionItem } from "../helpers";
import { MeetingActionList } from "../meeting-action-list";
import { CommentThread } from "../comments";
import { TopicIcon } from "@/components/meeting-setup/settings-editor";
import { Reactions } from "../reactions";
import { Attachments } from "../attachments";

export function DiscussStep() {
  const { state, op } = useMeeting();
  const items = useMemo(() => discussList(state), [state]);
  const presenting = state.meeting.presenting?.active;
  const [localFocus, setLocalFocus] = useState<string | null>(null);
  const focusId = presenting ? state.meeting.presenting?.targetId ?? items[0]?.id : localFocus;

  if (focusId) {
    return (
      <PresentationView
        items={items}
        focusId={focusId}
        onNavigate={(id) => (presenting && state.me.isFacilitator ? void op("present.set", { active: true, targetId: id }) : setLocalFocus(id))}
        onClose={() => (presenting && state.me.isFacilitator ? void op("present.set", { active: false }) : setLocalFocus(null))}
        canNavigate={!presenting || state.me.isFacilitator}
        canClose={!presenting || state.me.isFacilitator}
      />
    );
  }

  return (
    <Board count={state.meeting.topics.length}>
      {state.meeting.topics.map((t) => {
        const list = items.filter((i) => i.topicId === t.id);
        return (
          <Column key={t.id} topic={t} count={list.length}>
            {list.map((item) => {
              const actions = state.actions.filter((a) => a.sourceId === item.id || item.ideas.some((i) => i.id === a.sourceId));
              const footer = (
                <div className="flex items-center gap-2">
                  {actions.length > 0 && <span className="text-xs text-muted-foreground">{actions.length} {actions.length === 1 ? "action" : "actions"}</span>}
                  <Button size="xs" variant="ghost" onClick={() => (state.me.isFacilitator ? void op("present.set", { active: true, targetId: item.id }) : setLocalFocus(item.id))}>
                    <MessagesSquare /> Discuss
                  </Button>
                  <VoteBadge votes={item.votes} />
                </div>
              );
              return item.kind === "group" && item.group ? (
                <GroupStackReadonly key={item.id} group={item.group} ideas={item.ideas} footer={<div className="flex justify-end">{footer}</div>} />
              ) : (
                <IdeaCard key={item.id} idea={item.ideas[0]} footer={footer} />
              );
            })}
            {!list.length && <p className="py-6 text-center text-xs text-muted-foreground">Nothing to discuss here</p>}
          </Column>
        );
      })}
    </Board>
  );
}

function PresentationView({ items, focusId, onNavigate, onClose, canNavigate, canClose }: { items: DiscussionItem[]; focusId: string; onNavigate: (id: string) => void; onClose: () => void; canNavigate: boolean; canClose: boolean }) {
  const { state } = useMeeting();
  const idx = Math.max(0, items.findIndex((i) => i.id === focusId));
  const item = items[idx];
  const prev = items[idx - 1];
  const next = items[idx + 1];
  useEffect(() => {
    if (!canNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")) return;
      if (e.key === "ArrowRight" && next) onNavigate(next.id);
      if (e.key === "ArrowLeft" && prev) onNavigate(prev.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNavigate, next, prev, onNavigate]);
  if (!item) return <p className="p-10 text-center text-muted-foreground">Nothing to discuss.</p>;
  const topic = state.meeting.topics.find((t) => t.id === item.topicId);
  const color = topicColor(state, item.topicId);
  const sourceIds = new Set([item.id, ...item.ideas.map((i) => i.id)]);
  const actions = state.actions.filter((a) => a.kind === "action" && a.sourceId && sourceIds.has(a.sourceId));
  return (
    <div className="h-full overflow-y-auto px-4 pb-32 scrollbar-thin">
      <div className="mx-auto max-w-3xl space-y-5 pt-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" disabled={!canNavigate || !prev} onClick={() => prev && onNavigate(prev.id)} aria-label="Previous">
            <ChevronLeft />
          </Button>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.id}
                type="button"
                disabled={!canNavigate}
                onClick={() => onNavigate(it.id)}
                className={cn("h-2 rounded-full transition-all", i === idx ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60")}
                aria-label={`Item ${i + 1}`}
              />
            ))}
          </div>
          <Button variant="ghost" size="icon" disabled={!canNavigate || !next} onClick={() => next && onNavigate(next.id)} aria-label="Next">
            <ChevronRight />
          </Button>
          {canClose && (
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Back to board">
              <X />
            </Button>
          )}
        </div>
        <div className="relative rounded-3xl border p-6 shadow-sm" style={{ background: ideaBg(color, 0.14) }}>
          <div className="absolute -top-3 -right-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow-lg">{item.votes}</span>
          </div>
          <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
            {topic && <TopicIcon name={topic.icon} color={topic.color} className="size-4" />}
            {topic?.title}
            <span className="ml-auto text-xs">{idx + 1} / {items.length}</span>
          </div>
          {item.kind === "group" ? (
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold">{item.group?.title || "Group"}</h2>
              <ul className="space-y-2">
                {item.ideas.map((i) => (
                  <li key={i.id} className="rounded-xl bg-background/60 px-4 py-2.5">
                    <p className="text-base">{i.text}</p>
                    <Attachments items={i.attachments} />
                    {i.poll && <PollWidget poll={i.poll} />}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              {item.ideas[0].poll ? <PollWidget poll={item.ideas[0].poll} large /> : <h2 className="text-2xl leading-snug font-semibold whitespace-pre-wrap">{item.ideas[0].text}</h2>}
              <Attachments items={item.ideas[0].attachments} />
              <PresentationReactions ideaId={item.ideas[0].id} />
            </div>
          )}
        </div>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Actions</h3>
          <MeetingActionList kind="action" items={actions} source={{ type: item.kind, id: item.id }} />
        </section>
        {state.meeting.options.comments !== false && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Comments</h3>
            <CommentThread targetType={item.kind} targetId={item.id} />
            {item.kind === "group" &&
              item.ideas.map((i) =>
                state.comments.some((c) => c.targetId === i.id) ? (
                  <div key={i.id} className="rounded-xl border p-3">
                    <p className="mb-2 text-xs text-muted-foreground">On “{i.text}”</p>
                    <CommentThread targetType="idea" targetId={i.id} compact />
                  </div>
                ) : null,
              )}
          </section>
        )}
        {state.me.isFacilitator && !state.meeting.presenting?.active && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Presentation className="size-3.5" /> Tip: use Present in the toolbar to lead everyone through items together.
          </p>
        )}
      </div>
    </div>
  );
}

function PresentationReactions({ ideaId }: { ideaId: string }) {
  const { state, op } = useMeeting();
  const idea = state.ideas.find((i) => i.id === ideaId);
  if (!idea) return null;
  const canReact = state.meeting.options.reactions !== false && !!state.me.participantId && state.me.role !== "observer";
  return (
    <div className="group/card">
      <Reactions reactions={idea.reactions} canReact={canReact} onToggle={(emoji) => void op("reaction.toggle", { targetId: idea.id, emoji })} />
    </div>
  );
}
