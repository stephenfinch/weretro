"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  ExternalLink,
  Flag,
  Handshake,
  MoreHorizontal,
  ParkingSquare,
  Pencil,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
  Minus,
  Copy,
  ListChecks,
  Send,
} from "lucide-react";
import { format, parseISO, isBefore, startOfDay } from "date-fns";
import { toast } from "sonner";
import type { ActionDTO } from "@/lib/meeting-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { UserAvatar } from "@/components/user-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type MemberLite = { userId: string; name: string; color: string; avatarUrl: string | null };
export type Kind = "action" | "agreement" | "parked";

export type ActionHandlers = {
  onAdd?: (title: string, opts: { propose: boolean }) => Promise<void> | void;
  onUpdate?: (id: string, patch: Record<string, unknown>) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  onVote?: (id: string, value: "agree" | "neutral" | "disagree" | "none") => Promise<void> | void;
  onPublish?: (id: string) => void;
};

const KIND_META: Record<Kind, { icon: typeof ListChecks; add: string; propose: string; empty: string }> = {
  action: { icon: ListChecks, add: "Add action…", propose: "Propose action…", empty: "No actions yet" },
  agreement: { icon: Handshake, add: "Add agreement…", propose: "Propose agreement…", empty: "No agreements yet" },
  parked: { icon: ParkingSquare, add: "Add item to parking lot…", propose: "Propose item for parking lot…", empty: "No parked items yet" },
};

export function ActionList({
  items,
  kind,
  members,
  canAdd = true,
  canPropose = false,
  canEdit = true,
  canComplete = true,
  isFacilitator = false,
  handlers,
  emptyText,
  compact,
  groupBySource,
  hideAdd,
}: {
  items: ActionDTO[];
  kind: Kind;
  members: MemberLite[];
  canAdd?: boolean;
  canPropose?: boolean;
  canEdit?: boolean;
  canComplete?: boolean;
  isFacilitator?: boolean;
  handlers: ActionHandlers;
  emptyText?: string;
  compact?: boolean;
  groupBySource?: boolean;
  hideAdd?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const meta = KIND_META[kind];
  const proposeOnly = canPropose && !canAdd;
  const submit = async (propose: boolean) => {
    if (!text.trim() || !handlers.onAdd) return;
    setBusy(true);
    try {
      await handlers.onAdd(text.trim(), { propose });
      setText("");
    } finally {
      setBusy(false);
    }
  };
  const sorted = useMemo(() => {
    const order = (a: ActionDTO) => (a.status === "proposed" || a.status === "suggested" ? 0 : a.status === "completed" ? 2 : 1);
    return [...items].sort((a, b) => order(a) - order(b) || a.position - b.position);
  }, [items]);
  return (
    <div className="space-y-2">
      {!hideAdd && (canAdd || canPropose) && handlers.onAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit(proposeOnly);
          }}
          className="flex items-center gap-2 rounded-xl border bg-card px-2 focus-within:ring-2 focus-within:ring-ring/40"
        >
          <meta.icon className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={proposeOnly ? meta.propose : meta.add}
            className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            disabled={busy}
          />
          {text.trim() && (
            <div className="flex gap-1">
              {canPropose && canAdd && (
                <Button type="button" size="xs" variant="outline" onClick={() => void submit(true)}>
                  Propose
                </Button>
              )}
              <Button type="submit" size="xs">{proposeOnly ? "Propose" : "Add"}</Button>
            </div>
          )}
        </form>
      )}
      {!sorted.length && <p className="rounded-xl border border-dashed py-4 text-center text-sm text-muted-foreground">{emptyText ?? meta.empty}</p>}
      <ul className={cn("space-y-1.5", compact && "space-y-1")}>
        {groupBySource
          ? Object.entries(
              sorted.reduce<Record<string, ActionDTO[]>>((acc, a) => {
                const k = a.sourceText ?? "";
                (acc[k] ??= []).push(a);
                return acc;
              }, {}),
            ).map(([source, list]) => (
              <li key={source} className="space-y-1.5">
                {source && <p className="pt-2 text-xs font-medium text-muted-foreground">{source}</p>}
                <ul className="space-y-1.5">
                  {list.map((a) => (
                    <ActionRow key={a.id} a={a} kind={kind} members={members} canEdit={canEdit} canComplete={canComplete} isFacilitator={isFacilitator} handlers={handlers} compact={compact} />
                  ))}
                </ul>
              </li>
            ))
          : sorted.map((a) => <ActionRow key={a.id} a={a} kind={kind} members={members} canEdit={canEdit} canComplete={canComplete} isFacilitator={isFacilitator} handlers={handlers} compact={compact} />)}
      </ul>
    </div>
  );
}

function ActionRow({
  a,
  kind,
  members,
  canEdit,
  canComplete,
  isFacilitator,
  handlers,
  compact,
}: {
  a: ActionDTO;
  kind: Kind;
  members: MemberLite[];
  canEdit: boolean;
  canComplete: boolean;
  isFacilitator: boolean;
  handlers: ActionHandlers;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a.title);
  const done = a.status === "completed";
  const proposed = a.status === "proposed" || a.status === "suggested";
  const update = (patch: Record<string, unknown>) => handlers.onUpdate?.(a.id, patch);
  const overdue = a.dueDate && !done && isBefore(parseISO(a.dueDate), startOfDay(new Date()));
  return (
    <li className={cn("group rounded-xl border bg-card px-3 py-2 transition-colors", proposed && "border-dashed border-primary/50 bg-primary/5", done && "opacity-70")}>
      <div className="flex items-start gap-2">
        {kind === "action" && !proposed ? (
          <button
            type="button"
            disabled={!canComplete}
            onClick={() => update({ status: done ? "accepted" : "completed" })}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary disabled:cursor-default"
            aria-label={done ? "Mark incomplete" : "Mark complete"}
          >
            {done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5" />}
          </button>
        ) : (
          <span className="mt-0.5 shrink-0 text-muted-foreground">
            {kind === "agreement" ? <Handshake className="size-4" /> : kind === "parked" ? <ParkingSquare className="size-4" /> : <Sparkles className="size-4 text-primary" />}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) void update({ title: draft.trim() });
                setEditing(false);
              }}
            >
              <Input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(false)} className="h-8" />
            </form>
          ) : (
            <p
              className={cn("text-sm leading-snug break-words whitespace-pre-wrap", done && "line-through")}
              onDoubleClick={() => {
                if (!canEdit) return;
                setDraft(a.title);
                setEditing(true);
              }}
            >
              {a.title}
            </p>
          )}
          {!compact && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {proposed && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{a.status === "suggested" ? "Suggested" : "Proposed"}</span>}
              {a.ai && <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 font-medium text-violet-600 dark:text-violet-300">AI</span>}
              {a.sourceText && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="max-w-56 truncate">Inspired by “{a.sourceText}”{a.sourceMeetingTitle ? ` in ${a.sourceMeetingTitle}` : ""}</span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{a.sourceText}</TooltipContent>
                </Tooltip>
              )}
              {a.dueDate && (
                <span className={cn("inline-flex items-center gap-1", overdue && "font-medium text-destructive")}>
                  <CalendarDays className="size-3" /> {format(parseISO(a.dueDate), "EEE, MMM d")}
                </span>
              )}
              {a.priority && (
                <span className={cn("inline-flex items-center gap-1 font-medium", a.priority === "high" ? "text-red-500" : a.priority === "medium" ? "text-amber-500" : "text-sky-500")}>
                  <Flag className="size-3" /> {a.priority[0].toUpperCase() + a.priority.slice(1)}
                </span>
              )}
              {a.published.map((p) =>
                p.url ? (
                  <a key={p.integrationId} href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="size-3" /> {p.type}
                  </a>
                ) : (
                  <span key={p.integrationId} className="inline-flex items-center gap-1">
                    <Check className="size-3" /> {p.type}
                  </span>
                ),
              )}
            </div>
          )}
          {proposed && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(["agree", "neutral", "disagree"] as const).map((v) => {
                const Icon = v === "agree" ? ThumbsUp : v === "neutral" ? Minus : ThumbsDown;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => handlers.onVote?.(a.id, a.votes.mine === v ? "none" : v)}
                    className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", a.votes.mine === v ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
                  >
                    <Icon className="size-3" /> {a.votes[v]}
                  </button>
                );
              })}
              {isFacilitator && (
                <>
                  <Button size="xs" className="ml-auto" onClick={() => update({ status: "accepted" })}>
                    Accept
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => update({ status: "rejected" })}>
                    Don&apos;t accept
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {kind === "action" && (
            <AssigneePicker members={members} value={a.assigneeIds} disabled={!canEdit} onChange={(ids) => update({ assigneeIds: ids })} assignees={a.assignees} />
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger className="rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-muted data-[state=open]:opacity-100" aria-label="More options">
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() => {
                    setDraft(a.title);
                    setEditing(true);
                  }}
                >
                  <Pencil /> Edit
                </DropdownMenuItem>
                {kind === "action" && (
                  <>
                    <DueDateMenu value={a.dueDate} onChange={(d) => update({ dueDate: d })} />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Flag /> Priority
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {[null, "low", "medium", "high"].map((p) => (
                          <DropdownMenuItem key={String(p)} onSelect={() => update({ priority: p })}>
                            {p ? p[0].toUpperCase() + p.slice(1) : "None"}
                            {a.priority === p && <Check className="ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(a.title);
                    toast.success("Copied to clipboard");
                  }}
                >
                  <Copy /> Copy text
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Move to</DropdownMenuLabel>
                {(["action", "agreement", "parked"] as const)
                  .filter((k) => k !== kind)
                  .map((k) => (
                    <DropdownMenuItem key={k} onSelect={() => update({ kind: k })}>
                      {k === "action" ? <ListChecks /> : k === "agreement" ? <Handshake /> : <ParkingSquare />}
                      {k === "action" ? "Actions" : k === "agreement" ? "Agreements" : "Parking lot"}
                    </DropdownMenuItem>
                  ))}
                {handlers.onPublish && kind === "action" && (
                  <DropdownMenuItem onSelect={() => handlers.onPublish?.(a.id)}>
                    <Send /> Publish…
                  </DropdownMenuItem>
                )}
                {a.status !== "canceled" && kind === "action" && !proposed && (
                  <DropdownMenuItem onSelect={() => update({ status: "canceled" })}>
                    <Minus /> Cancel action
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => handlers.onDelete?.(a.id)}>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </li>
  );
}

function DueDateMenu({ value, onChange }: { value: string | null; onChange: (d: string | null) => void }) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <CalendarDays /> Due date
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="p-0">
        <Calendar
          mode="single"
          selected={value ? parseISO(value) : undefined}
          onSelect={(d) => onChange(d ? format(d, "yyyy-MM-dd") : null)}
        />
        {value && (
          <div className="border-t p-1">
            <DropdownMenuItem onSelect={() => onChange(null)}>Clear due date</DropdownMenuItem>
          </div>
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function AssigneePicker({
  members,
  value,
  onChange,
  disabled,
  assignees,
}: {
  members: MemberLite[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  assignees: { id: string; name: string; color: string; avatarUrl: string | null }[];
}) {
  const [q, setQ] = useState("");
  const filtered = members.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Popover>
      <PopoverTrigger disabled={disabled} className="flex items-center rounded-full outline-none" aria-label="Assign">
        {assignees.length ? (
          <span className="inline-flex -space-x-1.5">
            {assignees.slice(0, 3).map((u) => (
              <UserAvatar key={u.id} name={u.name} color={u.color} src={u.avatarUrl} size={22} ring />
            ))}
            {assignees.length > 3 && <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-muted text-[10px] ring-2 ring-background">+{assignees.length - 3}</span>}
          </span>
        ) : (
          !disabled && (
            <span className="inline-flex size-[22px] items-center justify-center rounded-full border border-dashed text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground">
              <UserPlus className="size-3" />
            </span>
          )
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Assign to…" className="mb-2 h-8" />
        <div className="max-h-64 overflow-y-auto">
          {filtered.map((m) => {
            const on = value.includes(m.userId);
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => onChange(on ? value.filter((v) => v !== m.userId) : [...value, m.userId])}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <UserAvatar name={m.name} color={m.color} src={m.avatarUrl} size={22} />
                <span className="truncate">{m.name}</span>
                {on && <Check className="ml-auto size-4 text-primary" />}
              </button>
            );
          })}
          {!filtered.length && <p className="p-2 text-xs text-muted-foreground">No matching members</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
