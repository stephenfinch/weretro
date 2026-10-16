"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Check, ChevronDown, ChevronRight, Copy, GripVertical, ListChecks, MoreHorizontal, ParkingSquare, Trash2, Ungroup, X } from "lucide-react";
import { toast } from "sonner";
import type { GroupDTO, IdeaDTO } from "@/lib/meeting-types";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMeeting } from "../use-meeting";
import { Board, Column } from "../board-column";
import { IdeaCard, useIdeaColor } from "../idea-card";
import { groupSort, ideaBg, sortItems, stepOptions, topicColor } from "../helpers";
import type { GroupOptions } from "@/lib/types";

export function GroupStep() {
  const { state, op } = useMeeting();
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const opts = stepOptions<GroupOptions>(state, "group");
  const canGroup = state.meeting.status === "open" && !!state.me.participantId && state.me.role !== "observer" && ((opts.permission ?? "participant") === "participant" || state.me.isFacilitator);

  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const from = String(e.active.id);
    const to = e.over ? String(e.over.id) : null;
    if (!to) return;
    if (from.startsWith("idea:")) {
      const id = from.slice(5);
      const idea = state.ideas.find((i) => i.id === id);
      if (to.startsWith("drop-idea:")) {
        const target = to.slice(10);
        if (target !== id) void op("idea.combine", { id, targetId: target });
      } else if (to.startsWith("drop-group:")) {
        const gid = to.slice(11);
        if (idea?.groupId !== gid) void op("idea.move", { id, groupId: gid });
      } else if (to.startsWith("drop-topic:")) {
        const topicId = to.slice(11);
        if (idea && (idea.groupId || idea.topicId !== topicId)) void op("idea.move", { id, groupId: null, topicId, position: Date.now() / 1e12 + 1e6 });
      }
    } else if (from.startsWith("group:")) {
      const gid = from.slice(6);
      if (to.startsWith("drop-group:") && to.slice(11) !== gid) void op("group.merge", { id: gid, targetId: to.slice(11) });
      else if (to.startsWith("drop-idea:")) {
        const target = state.ideas.find((i) => i.id === to.slice(10));
        if (target?.groupId && target.groupId !== gid) void op("group.merge", { id: gid, targetId: target.groupId });
        else if (target && !target.groupId) void op("idea.move", { id: target.id, groupId: gid });
      } else if (to.startsWith("drop-topic:")) void op("group.update", { id: gid, topicId: to.slice(11) });
    }
  };

  const activeIdea = active?.startsWith("idea:") ? state.ideas.find((i) => i.id === active.slice(5)) : null;
  const activeGroup = active?.startsWith("group:") ? state.groups.find((g) => g.id === active.slice(6)) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => setActive(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <Board count={state.meeting.topics.length}>
        {state.meeting.topics.map((t) => (
          <TopicDrop key={t.id} topicId={t.id}>
            {(ref, over) => {
              const groups = state.groups.filter((g) => g.topicId === t.id);
              const loose = state.ideas.filter((i) => i.topicId === t.id && !i.groupId);
              const entries = sortItems(
                [
                  ...groups.map((g) => ({ id: g.id, topicId: t.id, position: g.position, authorId: null, kind: "group" as const, g })),
                  ...loose.map((i) => ({ id: i.id, topicId: t.id, position: i.position, authorId: i.authorId, kind: "idea" as const, i })),
                ],
                state,
                groupSort(state),
              );
              return (
                <Column topic={t} innerRef={ref} highlight={over} count={state.ideas.filter((i) => i.topicId === t.id).length}>
                  {entries.map((e) =>
                    e.kind === "group" ? (
                      <GroupBox key={e.id} group={e.g} ideas={state.ideas.filter((i) => i.groupId === e.g.id).sort((a, b) => a.position - b.position)} canGroup={canGroup} />
                    ) : (
                      <DraggableIdea key={e.id} idea={e.i} canGroup={canGroup} />
                    ),
                  )}
                </Column>
              );
            }}
          </TopicDrop>
        ))}
      </Board>
      <DragOverlay dropAnimation={null}>
        {activeIdea && <IdeaCard idea={activeIdea} className="w-[300px] rotate-2 shadow-xl" />}
        {activeGroup && (
          <div className="w-[300px] rotate-2 rounded-xl border bg-card p-3 shadow-xl">
            <p className="text-sm font-medium">{activeGroup.title || "Group"}</p>
            <p className="text-xs text-muted-foreground">{state.ideas.filter((i) => i.groupId === activeGroup.id).length} ideas</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function TopicDrop({ topicId, children }: { topicId: string; children: (ref: (el: HTMLElement | null) => void, over: boolean) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `drop-topic:${topicId}` });
  return <>{children(setNodeRef, isOver)}</>;
}

function DraggableIdea({ idea, canGroup, inGroup }: { idea: IdeaDTO; canGroup: boolean; inGroup?: boolean }) {
  const drag = useDraggable({ id: `idea:${idea.id}`, disabled: !canGroup });
  const drop = useDroppable({ id: `drop-idea:${idea.id}`, disabled: !canGroup });
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      className={cn("rounded-xl transition", drag.isDragging && "opacity-30", drop.isOver && !drag.isDragging && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
    >
      <IdeaCard
        idea={idea}
        inGroup={inGroup}
        dragHandle={
          canGroup ? (
            <button type="button" {...drag.listeners} {...drag.attributes} className="mt-0.5 -ml-1 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground active:cursor-grabbing" aria-label="Drag to group">
              <GripVertical className="size-4" />
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

function GroupBox({ group, ideas, canGroup }: { group: GroupDTO; ideas: IdeaDTO[]; canGroup: boolean }) {
  const { state, op } = useMeeting();
  const [title, setTitle] = useState(group.title);
  const [editing, setEditing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const drag = useDraggable({ id: `group:${group.id}`, disabled: !canGroup });
  const drop = useDroppable({ id: `drop-group:${group.id}`, disabled: !canGroup });
  const colorOf = useIdeaColor();
  const color = ideas[0] ? colorOf(ideas[0]) : topicColor(state, group.topicId);
  const save = () => {
    setEditing(false);
    if (title !== group.title) void op("group.update", { id: group.id, title });
  };
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      className={cn("rounded-2xl border p-2 transition", group.suggested && "border-dashed border-primary", drag.isDragging && "opacity-30", drop.isOver && !drag.isDragging && "ring-2 ring-primary")}
      style={{ background: ideaBg(color, 0.1) }}
    >
      <div className="mb-1.5 flex items-center gap-1">
        {canGroup && (
          <button type="button" {...drag.listeners} {...drag.attributes} className="cursor-grab touch-none text-muted-foreground/60 hover:text-foreground" aria-label="Drag group">
            <GripVertical className="size-4" />
          </button>
        )}
        <button type="button" onClick={() => setCollapsed(!collapsed)} className="text-muted-foreground" aria-label={collapsed ? "Expand group" : "Collapse group"}>
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
        {editing ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Group title…"
            className="min-w-0 flex-1 rounded-md bg-background/70 px-2 py-0.5 text-sm font-semibold outline-none"
          />
        ) : (
          <button type="button" disabled={!canGroup} onClick={() => setEditing(true)} className={cn("min-w-0 flex-1 truncate text-left text-sm font-semibold", !group.title && "text-muted-foreground italic")}>
            {group.title || "Group title…"}
          </button>
        )}
        {group.suggested && <span className="rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary uppercase">Suggested</span>}
        <span className="rounded-full bg-background/70 px-1.5 text-xs text-muted-foreground">{ideas.length}</span>
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded p-0.5 text-muted-foreground hover:bg-background" aria-label="More group options">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {group.suggested && (
              <>
                <DropdownMenuItem onSelect={() => void op("group.accept", { id: group.id })}>
                  <Check /> Accept group suggestion
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void op("group.ungroup", { id: group.id })}>
                  <X /> Reject group suggestion
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard.writeText([group.title, ...ideas.map((i) => `- ${i.text}`)].filter(Boolean).join("\n"));
                toast.success("Copied to clipboard");
              }}
            >
              <Copy /> Copy group to clipboard
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void op("action.add", { kind: "action", title: group.title || ideas.map((i) => i.text).join(" / "), sourceType: "group", sourceId: group.id })}>
              <ListChecks /> Copy group to action
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void op("group.park", { id: group.id, parked: !group.parked })}>
              <ParkingSquare /> {group.parked ? "Unpark this group" : "Park this group"}
            </DropdownMenuItem>
            {canGroup && (
              <DropdownMenuItem onSelect={() => void op("group.ungroup", { id: group.id })}>
                <Ungroup /> Ungroup all
              </DropdownMenuItem>
            )}
            {state.me.isFacilitator && (
              <DropdownMenuItem variant="destructive" onSelect={() => void op("group.delete", { id: group.id })}>
                <Trash2 /> Delete group
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {!collapsed && (
        <div className="space-y-1.5">
          {ideas.map((i) => (
            <DraggableIdea key={i.id} idea={i} canGroup={canGroup} inGroup />
          ))}
        </div>
      )}
      {group.suggested && (
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => void op("group.accept", { id: group.id })} className="flex-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">Accept</button>
          <button type="button" onClick={() => void op("group.ungroup", { id: group.id })} className="flex-1 rounded-lg border px-2 py-1 text-xs font-medium">Reject</button>
        </div>
      )}
    </div>
  );
}

export function GroupStackReadonly({ group, ideas, footer }: { group: GroupDTO; ideas: IdeaDTO[]; footer?: React.ReactNode }) {
  const { state } = useMeeting();
  const colorOf = useIdeaColor();
  const color = ideas[0] ? colorOf(ideas[0]) : topicColor(state, group.topicId);
  return (
    <div className="rounded-2xl border p-2" style={{ background: ideaBg(color, 0.1) }}>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{group.title || <span className="italic text-muted-foreground">Untitled group</span>}</p>
        <span className="rounded-full bg-background/70 px-1.5 text-xs text-muted-foreground">{ideas.length}</span>
      </div>
      <div className="space-y-1.5">
        {ideas.map((i) => (
          <IdeaCard key={i.id} idea={i} inGroup />
        ))}
      </div>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
